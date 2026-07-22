//+------------------------------------------------------------------+
//|  ZaionVest EA (Modelo A) — template MULTI-BLOCO                  |
//|  Estratégias estilo StrategyQuant: 1-3 blocos de condição        |
//|  combinados com E (AND). O corpo do RawSignal() e a inicialização|
//|  dos handles são GERADOS por compiler.py a partir do strategyDef, |
//|  espelhando build_signals() do backtest (o .ex5 opera IGUAL ao   |
//|  que foi validado na esteira DQ Labs).                           |
//|  Licença/kill-switch/fail-safe 24h via WebRequest, idênticos ao  |
//|  template de família simples.                                    |
//|  Os marcadores entre duplo-sublinhado são trocados na compilação.|
//+------------------------------------------------------------------+
#property strict
#property version   "3.00"
#include <Trade/Trade.mqh>

//--- Identidade / licença ---
input string InpEAId      = "__EA_ID__";      // id do EA na vitrine
input string InpEmail     = "";               // e-mail do assinante (obrigatório)
input string InpStatusUrl = "__STATUS_URL__"; // endpoint de licença
input int    InpDirection = __DIRECTION__;    // 0=both 1=long-only 2=short-only
input double InpLot       = __LOT__;          // lote normalizado por volatilidade
input ulong  InpMagic     = __MAGIC__;

//--- Gestão de saída (fixed SL/TP em ATR, igual ao backtest multi) ---
input int    InpAtrPeriod = __ATR_PERIOD__;
input double InpSlAtr     = __SL_ATR__;
input double InpTpAtr     = __TP_ATR__;

CTrade   trade;
int      hAtr=INVALID_HANDLE;
// handles dos blocos (gerados):
__HANDLE_DECLS__
datetime g_lastLicenseCheck=0;
datetime g_lastGoodLicense=0;
bool     g_licenseOk=true;
datetime g_lastBarTime=0;

//+------------------------------------------------------------------+
double Buf(int handle,int shift,int buffer=0)
{
   double b[];
   if(CopyBuffer(handle,buffer,shift,1,b)<=0) return(0.0);
   return(b[0]);
}

//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(InpMagic);
   hAtr = iATR(_Symbol,_Period,InpAtrPeriod);
   // init dos handles dos blocos (gerado):
__HANDLE_INITS__
   g_lastGoodLicense = TimeCurrent();
   if(InpEmail=="")
      Print("ZaionVest: informe seu e-mail de assinante no input InpEmail.");
   UpdateDashboard();
   return(INIT_SUCCEEDED);
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
//| Sinal cru: AND dos blocos na barra FECHADA (shift 1).            |
//| Gerado por compiler.py — espelha blocks.build_signals().         |
//| long vence se ambos (igual ao Python: sig[short]=-1; sig[long]=1)|
//+------------------------------------------------------------------+
int RawSignal()
{
   double c  = iClose(_Symbol,_Period,1);   // barra fechada
   double c2 = iClose(_Symbol,_Period,2);   // barra anterior
   bool long_ok  = true;
   bool short_ok = true;
__SIGNAL_BODY__
   if(long_ok)  return(1);
   if(short_ok) return(-1);
   return(0);
}

//+------------------------------------------------------------------+
//| Filtro de direção (long-only / short-only)                       |
//+------------------------------------------------------------------+
int EntrySignal()
{
   int sig=RawSignal();
   if(InpDirection==1 && sig==-1) return(0);
   if(InpDirection==2 && sig==1)  return(0);
   return(sig);
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
      if(PositionSelect(_Symbol) && PositionGetInteger(POSITION_MAGIC)==(long)InpMagic)
         trade.PositionClose(_Symbol);
      return(true);
   }
   return(false);
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
   DrawLabel("ZV_HEADER", "ZAIONVEST MULTI-BLOCK", 20, 20, C'245,245,245', 10, "Arial Bold");
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

   int dir=PosDir();

   // saída por sinal contrário (fixed_sltp fecha a mercado, não flipa) —
   // espelha o backtest: `if pos!=0 and s==-pos: close_trade(close[i])`.
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
      if(atr>0)
      {
         sl=(sig==1)?price-InpSlAtr*atr:price+InpSlAtr*atr;
         tp=(sig==1)?price+InpTpAtr*atr:price-InpTpAtr*atr;
      }
      if(sig==1) trade.Buy(InpLot,_Symbol,0.0,sl,tp);
      else       trade.Sell(InpLot,_Symbol,0.0,sl,tp);
   }
}
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Funções auxiliares dos indicadores Abysse (cálculo autônomo)   |
//+------------------------------------------------------------------+
double GetWMA(int period, int shift)
{
   double sum=0;
   int weight_sum=0;
   for(int i=0; i<period; i++) {
      double val = iClose(_Symbol,_Period,shift+i);
      sum += val * (period - i);
      weight_sum += (period - i);
   }
   return (weight_sum>0)?(sum/weight_sum):0.0;
}

double GetHMA(int period, int shift)
{
   int half = period / 2;
   int sqr = (int)MathSqrt(period);
   if(half<1) half=1;
   if(sqr<1) sqr=1;
   
   double diff[]; ArrayResize(diff, sqr);
   for(int i=0; i<sqr; i++) {
      double wma_half = 0;
      double wma_full = 0;
      int w_half_sum = 0;
      int w_full_sum = 0;
      for(int j=0; j<half; j++) {
         wma_half += iClose(_Symbol,_Period,shift+i+j) * (half - j);
         w_half_sum += (half - j);
      }
      for(int j=0; j<period; j++) {
         wma_full += iClose(_Symbol,_Period,shift+i+j) * (period - j);
         w_full_sum += (period - j);
      }
      double val_half = (w_half_sum>0)?(wma_half/w_half_sum):0.0;
      double val_full = (w_full_sum>0)?(wma_full/w_full_sum):0.0;
      diff[i] = 2 * val_half - val_full;
   }
   double hma=0;
   int w_sqr_sum=0;
   for(int i=0; i<sqr; i++) {
      hma += diff[i] * (sqr - i);
      w_sqr_sum += (sqr - i);
   }
   return (w_sqr_sum>0)?(hma/w_sqr_sum):0.0;
}

double GetSupertrend(int period, double multiplier, int shift)
{
   double trend = 1;
   double curr_up = 0;
   double curr_dn = 0;
   int hAtrLocal = iATR(_Symbol,_Period,period);
   if(hAtrLocal==INVALID_HANDLE) return(1.0);
   
   int bars_to_calc = 100;
   double closes[], highs[], lows[], atrs[];
   ArrayResize(closes, bars_to_calc);
   ArrayResize(highs, bars_to_calc);
   ArrayResize(lows, bars_to_calc);
   ArrayResize(atrs, bars_to_calc);
   
   if(CopyClose(_Symbol,_Period,shift,bars_to_calc,closes)<=0 ||
      CopyHigh(_Symbol,_Period,shift,bars_to_calc,highs)<=0 ||
      CopyLow(_Symbol,_Period,shift,bars_to_calc,lows)<=0 ||
      CopyBuffer(hAtrLocal,0,shift,bars_to_calc,atrs)<=0)
   {
      IndicatorRelease(hAtrLocal);
      return(1.0);
   }
   
   // Inverte
   ArrayReverse(closes);
   ArrayReverse(highs);
   ArrayReverse(lows);
   ArrayReverse(atrs);
   
   curr_up = (highs[0]+lows[0])/2 + multiplier * atrs[0];
   curr_dn = (highs[0]+lows[0])/2 - multiplier * atrs[0];
   
   for(int i=1; i<bars_to_calc; i++) {
      double hl2 = (highs[i]+lows[i])/2;
      double up = hl2 + multiplier * atrs[i];
      double dn = hl2 - multiplier * atrs[i];
      
      if(closes[i-1] > curr_dn) curr_dn = MathMax(dn, curr_dn);
      else curr_dn = dn;
      
      if(closes[i-1] < curr_up) curr_up = MathMin(up, curr_up);
      else curr_up = up;
      
      if(closes[i] > curr_up) trend = 1;
      else if(closes[i] < curr_dn) trend = -1;
   }
   
   IndicatorRelease(hAtrLocal);
   return trend;
}

//+------------------------------------------------------------------+
//| T3 velocity (forex-tsd): iT3(hot) - iT3(hot/2)                    |
//| Cascata manual de 6 EMAs com o alpha EXATO do indicador. Nao uso  |
//| iMA(MODE_EMA) porque ele fixa alpha=2/(p+1), e o indicador usa    |
//| 2/(2+(p-1)/2) quando original=false — daria divergencia do Python.|
//| As duas chamadas iT3 do indicador compartilham alpha e preco, ou  |
//| seja, a cascata e a MESMA: so os coeficientes do 'hot' mudam.     |
//+------------------------------------------------------------------+
double GetT3Velocity(int period, double hot, bool original, int shift)
{
   double alpha = original ? 2.0/(1.0+period) : 2.0/(2.0+(period-1.0)/2.0);
   int bars  = Bars(_Symbol,_Period);
   int start = (int)MathMin(bars-1, 6*period + 300 + shift);
   if(start <= shift) return(0.0);

   double e[6];
   bool init=false;
   for(int i=start; i>=shift; i--)
   {
      double p = iClose(_Symbol,_Period,i);
      if(p<=0.0) continue;
      if(!init) { for(int k=0;k<6;k++) e[k]=p; init=true; continue; }
      e[0] += alpha*(p-e[0]);
      for(int k=1;k<6;k++) e[k] += alpha*(e[k-1]-e[k]);
   }
   if(!init) return(0.0);

   double vel=0.0;
   for(int s=0; s<2; s++)
   {
      double a  = (s==0) ? hot : hot/2.0;
      double c1 = -a*a*a;
      double c2 = 3*a*a + 3*a*a*a;
      double c3 = -6*a*a - 3*a - 3*a*a*a;
      double c4 = 1 + 3*a + a*a*a + 3*a*a;
      double t3 = c1*e[5] + c2*e[4] + c3*e[3] + c4*e[2];
      vel += (s==0) ? t3 : -t3;
   }
   return(vel);
}

//+------------------------------------------------------------------+
//| WPR suavizado com niveis flutuantes (mladen 2019)                |
//| Devolve o ESTADO: +1 long, -1 short, 0 neutro.                    |
//| mode: 0=break (rompe nivel de cima = long), 1=fade (inverso),     |
//|       2=zero (acima do nivel medio = long)                        |
//| NOTA: o indicador original declara inpFlPeriod mas nao usa — a    |
//| janela dos niveis e o proprio inpPeriod. Replicado fiel.          |
//+------------------------------------------------------------------+
int GetWPRFloatingState(int period, int smooth, double flUp, double flDn, int mode, int shift)
{
   int    n     = (smooth>0) ? smooth : period;
   double alpha = 2.0/(1.0+n);
   int    bars  = Bars(_Symbol,_Period);
   int    warm  = 3*n + 3*period + 300;
   int    start = (int)MathMin(bars-1, warm+shift);
   if(start <= shift+period) return(0);

   int    len = start-shift+1;
   double vals[], bh[], bl[];
   ArrayResize(vals,len); ArrayResize(bh,len); ArrayResize(bl,len);

   double sh=0,sl=0,sc=0; bool init=false; int idx=0;
   for(int i=start; i>=shift; i--)
   {
      double h=iHigh(_Symbol,_Period,i), l=iLow(_Symbol,_Period,i), c=iClose(_Symbol,_Period,i);
      if(!init) { sh=h; sl=l; sc=c; init=true; }
      else { sh+=alpha*(h-sh); sl+=alpha*(l-sl); sc+=alpha*(c-sc); }
      bh[idx]=sh; bl[idx]=sl;

      int from = (int)MathMax(0, idx-period+1);
      double mx=bh[from], mn=bl[from];
      for(int k=from; k<=idx; k++) { if(bh[k]>mx) mx=bh[k]; if(bl[k]<mn) mn=bl[k]; }
      vals[idx] = (mx!=mn) ? -(mx-sc)*100.0/(mx-mn) : 0.0;
      idx++;
   }

   int last = idx-1;
   if(last < 0) return(0);
   int from2 = (int)MathMax(0, last-period+1);
   double vmx=vals[from2], vmn=vals[from2];
   for(int k=from2; k<=last; k++) { if(vals[k]>vmx) vmx=vals[k]; if(vals[k]<vmn) vmn=vals[k]; }

   double range = (vmx-vmn)/100.0;
   double levu  = vmn + flUp*range;
   double levd  = vmn + flDn*range;
   double levm  = vmn + 50.0*range;
   double v     = vals[last];

   if(mode==1) return (v<levd) ?  1 : (v>levu) ? -1 : 0;   // fade
   if(mode==2) return (v>levm) ?  1 : (v<levm) ? -1 : 0;   // zero
   return              (v>levu) ?  1 : (v<levd) ? -1 : 0;   // break
}

double GetT3(int period, double vfactor, int shift)
{
   int hE1 = iMA(_Symbol,_Period,period,0,MODE_EMA,PRICE_CLOSE);
   int hE2 = iMA(_Symbol,_Period,period,0,MODE_EMA,hE1);
   int hE3 = iMA(_Symbol,_Period,period,0,MODE_EMA,hE2);
   int hE4 = iMA(_Symbol,_Period,period,0,MODE_EMA,hE3);
   int hE5 = iMA(_Symbol,_Period,period,0,MODE_EMA,hE4);
   int hE6 = iMA(_Symbol,_Period,period,0,MODE_EMA,hE5);
   
   if(hE1==INVALID_HANDLE || hE2==INVALID_HANDLE || hE3==INVALID_HANDLE ||
      hE4==INVALID_HANDLE || hE5==INVALID_HANDLE || hE6==INVALID_HANDLE)
   {
      if(hE1!=INVALID_HANDLE) IndicatorRelease(hE1);
      if(hE2!=INVALID_HANDLE) IndicatorRelease(hE2);
      if(hE3!=INVALID_HANDLE) IndicatorRelease(hE3);
      if(hE4!=INVALID_HANDLE) IndicatorRelease(hE4);
      if(hE5!=INVALID_HANDLE) IndicatorRelease(hE5);
      if(hE6!=INVALID_HANDLE) IndicatorRelease(hE6);
      return(0.0);
   }
   
   double e3 = Buf(hE3, shift);
   double e4 = Buf(hE4, shift);
   double e5 = Buf(hE5, shift);
   double e6 = Buf(hE6, shift);
   
   IndicatorRelease(hE1); IndicatorRelease(hE2); IndicatorRelease(hE3);
   IndicatorRelease(hE4); IndicatorRelease(hE5); IndicatorRelease(hE6);
   
   double c1 = -vfactor*vfactor*vfactor;
   double c2 = 3*vfactor*vfactor + 3*vfactor*vfactor*vfactor;
   double c3 = -6*vfactor*vfactor - 3*vfactor - 3*vfactor*vfactor*vfactor;
   double c4 = 1 + 3*vfactor + 3*vfactor*vfactor + vfactor*vfactor*vfactor;
   return c1*e6 + c2*e5 + c3*e4 + c4*e3;
}

void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, "ZV_");
}
//+------------------------------------------------------------------+
