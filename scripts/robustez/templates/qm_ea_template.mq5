//+------------------------------------------------------------------+
//|  ZaionVest EA (Modelo A) — template v2                           |
//|  Params baked-in por estratégia. Licença/kill-switch via         |
//|  WebRequest ao endpoint /api/ea/<id>/status.                     |
//|  v2: direção (long/short/both), lote normalizado, família GRID.  |
//|  Tokens __XXX__ são substituídos na compilação (compiler.py).    |
//+------------------------------------------------------------------+
#property strict
#property version   "2.00"
#include <Trade/Trade.mqh>

//--- Identidade / licença ---
input string InpEAId      = "__EA_ID__";      // id do EA na vitrine
input string InpEmail     = "";               // e-mail do assinante (obrigatório)
input string InpStatusUrl = "__STATUS_URL__"; // endpoint de licença
input int    InpFamily    = __FAMILY__;       // 0=trend 1=meanrev 2=breakout 3=grid 4=macd 5=bbfade 6=bbbreak 7=stoch
input int    InpExitMode  = __EXIT_MODE__;    // 0=reversal 1=fixed_sltp
input int    InpDirection = __DIRECTION__;    // 0=both 1=long-only 2=short-only
input double InpLot       = __LOT__;          // lote normalizado por volatilidade
input ulong  InpMagic     = __MAGIC__;

//--- Parâmetros da estratégia (baked-in) ---
input int    InpEmaFast   = __EMA_FAST__;
input int    InpEmaSlow   = __EMA_SLOW__;
input int    InpEmaFilter = __EMA_FILTER__;
input int    InpRsiPeriod = __RSI_PERIOD__;
input int    InpRsiOS     = __RSI_OS__;
input int    InpRsiOB     = __RSI_OB__;
input int    InpLookback  = __LOOKBACK__;
input int    InpAtrPeriod = __ATR_PERIOD__;
input double InpSlAtr     = __SL_ATR__;
input double InpTpAtr     = __TP_ATR__;
//--- Grid (família 3) ---
input double InpGridSpacing = __GRID_SPACING__; // em ATRs contra a posição
input int    InpGridLevels  = __GRID_LEVELS__;  // máx. de ordens no cesto
input double InpGridTp      = __GRID_TP__;      // ATRs além do preço médio
//--- MACD (família 4) / Bollinger (5-6) / Stochastic (7) ---
input int    InpMacdFast    = __MACD_FAST__;
input int    InpMacdSlow    = __MACD_SLOW__;
input int    InpMacdSignal  = __MACD_SIGNAL__;
input int    InpBbPeriod    = __BB_PERIOD__;
input double InpBbDev       = __BB_DEV__;
input int    InpStochK      = __STOCH_K__;
input int    InpStochSmooth = __STOCH_SMOOTH__;
input int    InpStochOS     = __STOCH_OS__;
input int    InpStochOB     = __STOCH_OB__;

CTrade   trade;
int      hEmaFast=INVALID_HANDLE, hEmaSlow=INVALID_HANDLE, hEmaFilter=INVALID_HANDLE;
int      hRsi=INVALID_HANDLE, hAtr=INVALID_HANDLE;
int      hMacd=INVALID_HANDLE, hBands=INVALID_HANDLE, hStoch=INVALID_HANDLE;
datetime g_lastLicenseCheck=0;
datetime g_lastGoodLicense=0;
bool     g_licenseOk=true;
datetime g_lastBarTime=0;

//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(InpMagic);
   if(InpFamily==0)
   {
      hEmaFast   = iMA(_Symbol,_Period,InpEmaFast,0,MODE_EMA,PRICE_CLOSE);
      hEmaSlow   = iMA(_Symbol,_Period,InpEmaSlow,0,MODE_EMA,PRICE_CLOSE);
      hEmaFilter = iMA(_Symbol,_Period,InpEmaFilter,0,MODE_EMA,PRICE_CLOSE);
   }
   else if(InpFamily==1 || InpFamily==3)
      hRsi = iRSI(_Symbol,_Period,InpRsiPeriod,PRICE_CLOSE);
   else if(InpFamily==4)
      hMacd = iMACD(_Symbol,_Period,InpMacdFast,InpMacdSlow,InpMacdSignal,PRICE_CLOSE);
   else if(InpFamily==5 || InpFamily==6)
      hBands = iBands(_Symbol,_Period,InpBbPeriod,0,InpBbDev,PRICE_CLOSE);
   else if(InpFamily==7)
      hStoch = iStochastic(_Symbol,_Period,InpStochK,InpStochSmooth,InpStochSmooth,MODE_SMA,STO_LOWHIGH);

   hAtr = iATR(_Symbol,_Period,InpAtrPeriod);
   g_lastGoodLicense = TimeCurrent();

   if(InpEmail=="")
      Print("ZaionVest: informe seu e-mail de assinante no input InpEmail.");
   UpdateDashboard();
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
double Buf(int handle,int shift,int buffer=0)
{
   double b[];
   if(CopyBuffer(handle,buffer,shift,1,b)<=0) return(0.0);
   return(b[0]);
}

//+------------------------------------------------------------------+
void CheckLicense()
{
   if(TimeCurrent()-g_lastLicenseCheck < 1800) return;   // a cada 30 min
   g_lastLicenseCheck = TimeCurrent();

   string headers = "Content-Type: application/json\r\n";
   string body = "{\"email\":\""+InpEmail+"\",\"account\":\""+
                 (string)AccountInfoInteger(ACCOUNT_LOGIN)+"\",\"company\":\""+
                 AccountInfoString(ACCOUNT_COMPANY)+"\"}";
   char post[]; StringToCharArray(body,post,0,StringLen(body));
   char result[]; string rheaders;

   int code = WebRequest("POST",InpStatusUrl,headers,5000,post,result,rheaders);
   if(code==-1)
   {
      // Fail-safe: sem contato, opera com o último status válido por 24h.
      if(TimeCurrent()-g_lastGoodLicense > 86400) g_licenseOk=false;
      return;
   }

   string resp = CharArrayToString(result);
   if(StringFind(resp,"\"valid\":true")>=0)
   {
      g_licenseOk = true;
      g_lastGoodLicense = TimeCurrent();
   }
   else
   {
      g_licenseOk = false;
      if(StringFind(resp,"ea_rejected")>=0)
         Alert("ZaionVest: estratégia REPROVADA na revalidação. Troque por outra aprovada na vitrine.");
      else if(StringFind(resp,"no_subscription")>=0)
         Alert("ZaionVest: assinatura inativa/expirada. Renove para continuar operando.");
      else if(StringFind(resp,"wrong_broker")>=0)
         Alert("ZaionVest: Este robô é exclusivo para a corretora RoboForex.");
      else if(StringFind(resp,"not_partner_account")>=0)
         Alert("ZaionVest: Esta conta não pertence ao grupo de parceiros ZAION na RoboForex. Abra sua conta pelo link oficial.");
   }
}

//+------------------------------------------------------------------+
bool NewBar()
{
   datetime t = iTime(_Symbol,_Period,0);
   if(t!=g_lastBarTime){ g_lastBarTime=t; return(true); }
   return(false);
}

//+------------------------------------------------------------------+
//| Sinal cru da família (sem filtro de direção)                     |
//+------------------------------------------------------------------+
int RawSignal()
{
   double c = iClose(_Symbol,_Period,1);   // barra fechada
   if(InpFamily==0)
   {
      double f=Buf(hEmaFast,1), s=Buf(hEmaSlow,1), fl=Buf(hEmaFilter,1);
      if(f>s && c>fl) return(1);
      if(f<s && c<fl) return(-1);
   }
   else if(InpFamily==1)
   {
      double rsi=Buf(hRsi,1);
      if(rsi<InpRsiOS) return(1);
      if(rsi>InpRsiOB) return(-1);
   }
   else if(InpFamily==2)
   {
      int ih=iHighest(_Symbol,_Period,MODE_HIGH,InpLookback,2);
      int il=iLowest(_Symbol,_Period,MODE_LOW,InpLookback,2);
      if(ih>=0 && il>=0)
      {
         if(c>iHigh(_Symbol,_Period,ih)) return(1);
         if(c<iLow(_Symbol,_Period,il)) return(-1);
      }
   }
   else if(InpFamily==4)   // MACD cross
   {
      double m1=Buf(hMacd,1,0), s1=Buf(hMacd,1,1);
      double m2=Buf(hMacd,2,0), s2=Buf(hMacd,2,1);
      if(m1>s1 && m2<=s2) return(1);
      if(m1<s1 && m2>=s2) return(-1);
   }
   else if(InpFamily==5)   // Bollinger fade (reversão)
   {
      double up=Buf(hBands,1,1), lo=Buf(hBands,1,2);
      if(c<lo) return(1);
      if(c>up) return(-1);
   }
   else if(InpFamily==6)   // Bollinger break (rompimento)
   {
      double up=Buf(hBands,1,1), lo=Buf(hBands,1,2);
      if(c>up) return(1);
      if(c<lo) return(-1);
   }
   else if(InpFamily==7)   // Stochastic
   {
      double st=Buf(hStoch,1,0);
      if(st<InpStochOS) return(1);
      if(st>InpStochOB) return(-1);
   }
   return(0);
}

//+------------------------------------------------------------------+
//| Exit on Friday (SQX): sexta >= 20h fecha tudo, sem novas ordens  |
//+------------------------------------------------------------------+
bool FridayShutdown()
{
   MqlDateTime t;
   TimeToStruct(TimeCurrent(),t);
   if(t.day_of_week==5 && t.hour>=20)
   {
      CloseBasket();   // fecha qualquer posição deste EA (magic)
      return(true);
   }
   return(false);
}

//+------------------------------------------------------------------+
//| Sinal de entrada (com filtro de direção)                         |
//+------------------------------------------------------------------+
int EntrySignal()
{
   int sig=RawSignal();
   if(InpDirection==1 && sig==-1) return(0);  // long-only não vende
   if(InpDirection==2 && sig==1)  return(0);  // short-only não compra
   return(sig);
}

//+------------------------------------------------------------------+
//| Cesto do grid: n, preço médio, direção e pior entrada            |
//+------------------------------------------------------------------+
int BasketInfo(double &avg, int &dir, double &worst)
{
   int n=0; double sum=0.0; dir=0; worst=0.0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong tk=PositionGetTicket(i);
      if(tk==0) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=(long)InpMagic) continue;
      double op=PositionGetDouble(POSITION_PRICE_OPEN);
      long type=PositionGetInteger(POSITION_TYPE);
      int d=(type==POSITION_TYPE_BUY)?1:-1;
      if(dir==0) dir=d;
      sum+=op; n++;
      if(n==1) worst=op;
      else worst = (d==1) ? MathMin(worst,op) : MathMax(worst,op);
   }
   avg = (n>0)? sum/n : 0.0;
   return(n);
}

void CloseBasket()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong tk=PositionGetTicket(i);
      if(tk==0) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=(long)InpMagic) continue;
      trade.PositionClose(tk);
   }
}

//+------------------------------------------------------------------+
//| Família GRID: cesto que média o preço e fecha no retorno         |
//+------------------------------------------------------------------+
void GridTick()
{
   double atr=Buf(hAtr,1);
   if(atr<=0) return;
   double px = iClose(_Symbol,_Period,1);

   double avg; int dir; double worst;
   int n=BasketInfo(avg,dir,worst);

   if(n>0)
   {
      // fecha o cesto no retorno ao médio + tp*ATR
      double target = avg + dir*InpGridTp*atr;
      if((dir==1 && px>=target) || (dir==-1 && px<=target))
      { CloseBasket(); return; }

      // adiciona nível se andou spacing*ATR contra a pior entrada
      if(g_licenseOk && n<InpGridLevels)
      {
         if(dir==1 && px<=worst-InpGridSpacing*atr)       trade.Buy(InpLot,_Symbol);
         else if(dir==-1 && px>=worst+InpGridSpacing*atr) trade.Sell(InpLot,_Symbol);
      }
      return;
   }

   if(!g_licenseOk) return;   // kill-switch: não abre cesto novo

   double rsi=Buf(hRsi,1);
   if(rsi<InpRsiOS && InpDirection!=2)      trade.Buy(InpLot,_Symbol);
   else if(rsi>InpRsiOB && InpDirection!=1) trade.Sell(InpLot,_Symbol);
}

//+------------------------------------------------------------------+
int PosDir()
{
   if(!PositionSelect(_Symbol)) return(0);
   if(PositionGetInteger(POSITION_MAGIC)!=(long)InpMagic) return(0);
   long type=PositionGetInteger(POSITION_TYPE);
   return (type==POSITION_TYPE_BUY)?1:-1;
}

//+------------------------------------------------------------------+
//| Helpers de Dashboard Grafico                                     |
//+------------------------------------------------------------------+
void DrawBg(string name, int x, int y, int width, int height, color bgCol, color borderCol)
{
   ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, width);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, height);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bgCol);
   ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, name, OBJPROP_COLOR, borderCol);
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, borderCol);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
}

void DrawLabel(string name, string text, int x, int y, color col, int fontSize=9, string font="Arial")
{
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetString(0, name, OBJPROP_FONT, font);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetInteger(0, name, OBJPROP_COLOR, col);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
}

string TimeframeToString(ENUM_TIMEFRAMES tf)
{
   if(tf == PERIOD_M1)  return "M1";
   if(tf == PERIOD_M5)  return "M5";
   if(tf == PERIOD_M15) return "M15";
   if(tf == PERIOD_M30) return "M30";
   if(tf == PERIOD_H1)  return "H1";
   if(tf == PERIOD_H4)  return "H4";
   if(tf == PERIOD_D1)  return "D1";
   return "TF";
}

double GetProfit(datetime fromTime)
{
   HistorySelect(fromTime, TimeCurrent());
   int total = HistoryDealsTotal();
   double p = 0;
   for(int i=0; i<total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(HistoryDealGetString(ticket, DEAL_SYMBOL) == _Symbol && HistoryDealGetInteger(ticket, DEAL_MAGIC) == InpMagic)
      {
         p += HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_COMMISSION) + HistoryDealGetDouble(ticket, DEAL_SWAP);
      }
   }
   return p;
}

double GetFloatingProfit()
{
   double p = 0;
   for(int i=PositionsTotal()-1; i>=0; i--)
   {
      string sym = PositionGetSymbol(i);
      if(sym == _Symbol)
      {
         ulong magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == InpMagic)
         {
            p += PositionGetDouble(POSITION_PROFIT);
         }
      }
   }
   return p;
}

void UpdateDashboard()
{
   double daily = GetProfit(TimeCurrent() - (TimeCurrent() % 86400));
   double weekly = GetProfit(TimeCurrent() - (TimeCurrent() % (86400 * 7)));
   double total = GetProfit(0);
   double floating = GetFloatingProfit();
   
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   double dd = (bal > 0) ? ((bal - eq) / bal * 100.0) : 0.0;
   
   int longs=0, shorts=0;
   for(int i=PositionsTotal()-1; i>=0; i--)
   {
      ulong tk=PositionGetTicket(i);
      if(tk==0) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC)!=(long)InpMagic) continue;
      long type=PositionGetInteger(POSITION_TYPE);
      if(type==POSITION_TYPE_BUY) longs++;
      else if(type==POSITION_TYPE_SELL) shorts++;
   }

   color cDaily = (daily >= 0) ? C'16,185,129' : C'244,63,94';
   color cTotal = (total >= 0) ? C'16,185,129' : C'244,63,94';
   color cLic = g_licenseOk ? C'16,185,129' : C'244,63,94';
   string sLic = g_licenseOk ? "LICENCA ATIVA" : "SEM LICENCA / INATIVO";

   DrawBg("ZV_BG", 10, 10, 240, 240, C'10,10,10', C'37,99,235');
   DrawLabel("ZV_HEADER", "ZAIONVEST EA v3", 20, 20, C'245,245,245', 10, "Arial Bold");
   DrawLabel("ZV_SUB", "Mag: " + (string)InpMagic + " | " + _Symbol + "," + TimeframeToString(_Period), 20, 38, C'113,113,122', 8);
   
   DrawLabel("ZV_L_LUCROS", "LUCROS", 20, 60, C'113,113,122', 8, "Arial Bold");
   DrawLabel("ZV_VAL_DAILY", "Diario: $" + DoubleToString(daily, 2), 20, 75, cDaily, 9);
   DrawLabel("ZV_VAL_WEEK", "Semanal: $" + DoubleToString(weekly, 2), 20, 90, C'200,200,200', 9);
   DrawLabel("ZV_VAL_TOTAL", "Total: $" + DoubleToString(total, 2), 20, 105, cTotal, 9);
   
   DrawLabel("ZV_L_RISK", "EXPOSICAO E RISCO", 20, 130, C'113,113,122', 8, "Arial Bold");
   DrawLabel("ZV_VAL_POS", "Posicoes: L: " + (string)longs + " | S: " + (string)shorts, 20, 145, C'200,200,200', 9);
   DrawLabel("ZV_VAL_FLOAT", "Flutuante: $" + DoubleToString(floating, 2), 20, 160, (floating >= 0 ? C'16,185,129' : C'244,63,94'), 9);
   DrawLabel("ZV_VAL_DD", "Drawdown Conta: " + DoubleToString(dd, 1) + "%", 20, 175, (dd > 15.0 ? C'244,63,94' : C'200,200,200'), 9);
   
   DrawBg("ZV_LINE", 20, 198, 220, 1, C'30,30,30', C'30,30,30');
   DrawLabel("ZV_VAL_LIC", sLic, 20, 205, cLic, 9, "Arial Bold");
   DrawLabel("ZV_VAL_TIME", "Atualizado: " + TimeToString(TimeLocal(), TIME_SECONDS), 20, 222, C'113,113,122', 8);
   
   ChartRedraw();
}

//+------------------------------------------------------------------+
void OnTick()
{
   CheckLicense();
   UpdateDashboard();
   if(!NewBar()) return;
   if(FridayShutdown()) return;


   if(InpFamily==3){ GridTick(); return; }

   int dir=PosDir();

   // saída por sinal contrário usa o sinal CRU: long-only fecha no sinal
   // de venda (só não abre venda) — espelha o backtest
   if(dir!=0 && RawSignal()==-dir)
   {
      trade.PositionClose(_Symbol);
      dir=0;
   }

   if(!g_licenseOk) return;   // kill-switch: não abre novas ordens

   int sig=EntrySignal();
   if(dir==0 && sig!=0)
   {
      double atr=Buf(hAtr,1);
      double price=(sig==1)?SymbolInfoDouble(_Symbol,SYMBOL_ASK)
                           :SymbolInfoDouble(_Symbol,SYMBOL_BID);
      double sl=0,tp=0;
      if(InpExitMode==1 && atr>0)
      {
         sl=(sig==1)?price-InpSlAtr*atr:price+InpSlAtr*atr;
         tp=(sig==1)?price+InpTpAtr*atr:price-InpTpAtr*atr;
      }
      if(sig==1) trade.Buy(InpLot,_Symbol,0.0,sl,tp);
      else       trade.Sell(InpLot,_Symbol,0.0,sl,tp);
   }
}

void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, "ZV_");
}
//+------------------------------------------------------------------+
