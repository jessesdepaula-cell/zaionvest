//+------------------------------------------------------------------+
//|  ZaionVest EA — template MULTI-BLOCO GRID (Grade + DD Guard)      |
//|  Estratégias de Grade Dinâmica com Stop Loss Global (DD Guard).   |
//|  - Sinais multi-condição abrem a 1ª posição da grade;             |
//|  - Novas posições são abertas a cada `grid_step_atr` * ATR;       |
//|  - Cesto inteiro fecha no Cluster TP (`grid_tp_atr` * ATR);       |
//|  - Trava de Segurança DD Guard encerra todas as posições se o DD  |
//|    flutuante atingir `dd_guard_pct` da conta.                     |
//+------------------------------------------------------------------+
#property strict
#property version   "3.00"
#include <Trade/Trade.mqh>

//--- Identidade / licença ---
input string InpEAId         = "__EA_ID__";      // id do EA na vitrine
input string InpEmail        = "";               // e-mail do assinante (obrigatório)
input string InpStatusUrl    = "__STATUS_URL__"; // endpoint de licença
input int    InpDirection    = __DIRECTION__;    // 0=both 1=long-only 2=short-only
input double InpLot          = __LOT__;          // lote base da ordem
input ulong  InpMagic        = __MAGIC__;

//--- Parâmetros da Grade Dinâmica ---
input int    InpAtrPeriod    = __ATR_PERIOD__;
input double InpGridStepAtr  = __GRID_STEP_ATR__;  // espaçamento da grade em ATR
input int    InpGridMaxLevels= __GRID_MAX_LEVELS__;// máximo de posições na grade
input double InpGridTpAtr    = __GRID_TP_ATR__;    // alvo de lucro do cesto em ATR
input double InpDDGuardPct   = __DD_GUARD_PCT__;   // DD Guard % da conta (Hard Stop)

CTrade   trade;
int      hAtr=INVALID_HANDLE;
// handles dos blocos (gerados):
__HANDLE_DECLS__
datetime g_lastLicenseCheck=0;
datetime g_lastGoodLicense=0;
bool     g_licenseOk=true;
datetime g_lastBarTime=0;
int      g_cooldown=0;

//+------------------------------------------------------------------+
double Buf(int handle,int shift,int buffer=0)
{
   double b[];
   if(CopyBuffer(handle,buffer,shift,1,b)<=0) return(0.0);
   return(b[0]);
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
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetInteger(POSITION_MAGIC) == (long)InpMagic)
      {
         p += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      }
   }
   return p;
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
      if(TimeCurrent()-g_lastGoodLicense > 86400) g_licenseOk=false;
      return;
   }

   string resp = CharArrayToString(result);
   if(StringFind(resp,"\"valid\":true")>=0 || StringFind(resp,"\"ok\":true")>=0)
   {
      g_licenseOk = true;
      g_lastGoodLicense = TimeCurrent();
   }
   else
   {
      g_licenseOk = false;
      if(StringFind(resp,"wrong_broker")>=0)
         Alert("ZaionVest: Este robô é exclusivo para a corretora RoboForex.");
   }
}

//+------------------------------------------------------------------+
bool IsNewBar()
{
   datetime t = iTime(_Symbol,_Period,0);
   if(t!=g_lastBarTime){ g_lastBarTime=t; return(true); }
   return(false);
}

//+------------------------------------------------------------------+
int RawSignal()
{
   double c  = iClose(_Symbol,_Period,1);
   double c2 = iClose(_Symbol,_Period,2);
   bool long_ok  = true;
   bool short_ok = true;
__SIGNAL_BODY__
   if(long_ok)  return(1);
   if(short_ok) return(-1);
   return(0);
}

//+------------------------------------------------------------------+
int EntrySignal()
{
   int sig=RawSignal();
   if(InpDirection==1 && sig==-1) return(0);
   if(InpDirection==2 && sig==1)  return(0);
   return(sig);
}

//+------------------------------------------------------------------+
void CloseAllBasket()
{
   for(int i=PositionsTotal()-1; i>=0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket>0)
      {
         if(PositionGetString(POSITION_SYMBOL)==_Symbol && PositionGetInteger(POSITION_MAGIC)==(long)InpMagic)
         {
            trade.PositionClose(ticket);
         }
      }
   }
}

//+------------------------------------------------------------------+
void OnTick()
{
   CheckLicense();
   UpdateDashboard();
   if(!g_licenseOk) return;

   // Exit on Friday: sexta >= 20h fecha cesto inteiro
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   if(dt.day_of_week==5 && dt.hour>=20)
   {
      CloseAllBasket();
      return;
   }

   double atrVal = Buf(hAtr, 0);
   if(atrVal <= 0) return;

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);

   // 1. DD GUARD (Hard Stop): se o floating loss exceder o limite % da conta
   int count = 0;
   double floatProfit = 0.0;
   double worstPx = 0.0;
   int basketDir = 0; // 1=buy, -1=sell

   for(int i=PositionsTotal()-1; i>=0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket>0 && PositionGetString(POSITION_SYMBOL)==_Symbol && PositionGetInteger(POSITION_MAGIC)==(long)InpMagic)
      {
         count++;
         floatProfit += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
         long type = PositionGetInteger(POSITION_TYPE);
         double px = PositionGetDouble(POSITION_PRICE_OPEN);
         if(type == POSITION_TYPE_BUY)
         {
            basketDir = 1;
            if(worstPx == 0.0 || px < worstPx) worstPx = px;
         }
         else if(type == POSITION_TYPE_SELL)
         {
            basketDir = -1;
            if(worstPx == 0.0 || px > worstPx) worstPx = px;
         }
      }
   }

   if(count > 0)
   {
      // DD Guard Trigger
      if(balance > 0 && (-floatProfit) / balance >= InpDDGuardPct)
      {
         Print("DD Guard ativado! Encerrando grade no Hard Stop.");
         CloseAllBasket();
         g_cooldown = 20;
         return;
      }

      // 2. Cluster TP Trigger
      double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
      double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
      double targetProfit = (InpGridTpAtr * atrVal / tickSize) * tickValue * InpLot;

      if(floatProfit >= targetProfit)
      {
         Print("Cluster TP atingido! Encerrando grade no lucro.");
         CloseAllBasket();
         return;
      }

      // 3. Adicionar novo nível de grade se o preço andou `InpGridStepAtr` * ATR contra a pior entrada
      if(count < InpGridMaxLevels && worstPx > 0.0)
      {
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         if(basketDir == 1 && bid <= worstPx - InpGridStepAtr * atrVal)
         {
            trade.Buy(InpLot, _Symbol, ask, 0, 0, "ZaionVest Grid Buy");
         }
         else if(basketDir == -1 && ask >= worstPx + InpGridStepAtr * atrVal)
         {
            trade.Sell(InpLot, _Symbol, bid, 0, 0, "ZaionVest Grid Sell");
         }
      }
   }
   else
   {
      // 4. Abertura inicial se fora de cooldown e sinal confirmado na barra nova
      if(g_cooldown > 0)
      {
         g_cooldown--;
      }
      else if(IsNewBar())
      {
         int sig = EntrySignal();
         if(sig == 1)
         {
            trade.Buy(InpLot, _Symbol, SymbolInfoDouble(_Symbol, SYMBOL_ASK), 0, 0, "ZaionVest Grid Open Long");
         }
         else if(sig == -1)
         {
            trade.Sell(InpLot, _Symbol, SymbolInfoDouble(_Symbol, SYMBOL_BID), 0, 0, "ZaionVest Grid Open Short");
         }
      }
   }
}

//+------------------------------------------------------------------+
void UpdateDashboard()
{
   DrawBg("ZV_BG", 10, 10, 240, 180, C'10,10,10', C'37,99,235');
   DrawLabel("ZV_HEADER", "ZAIONVEST · GRID DD-GUARD", 20, 20, C'245,245,245', 10, "Arial Bold");
   DrawLabel("ZV_SUB", "Mag: " + (string)InpMagic + " | " + _Symbol + "," + TimeframeToString(_Period), 20, 38, C'113,113,122', 8);
   
   double daily = GetProfit(TimeCurrent() - (TimeCurrent() % 86400));
   double floating = GetFloatingProfit();
   color cDaily = (daily >= 0) ? C'16,185,129' : C'244,63,94';
   color cLic = g_licenseOk ? C'16,185,129' : C'244,63,94';
   string sLic = g_licenseOk ? "LICENCA ATIVA" : "SEM LICENCA / INATIVO";

   DrawLabel("ZV_VAL_DAILY", "Diario: $" + DoubleToString(daily, 2), 20, 60, cDaily, 9);
   DrawLabel("ZV_VAL_FLOAT", "Flutuante: $" + DoubleToString(floating, 2), 20, 78, (floating >= 0 ? C'16,185,129' : C'244,63,94'), 9);
   DrawLabel("ZV_VAL_LIC", sLic, 20, 100, cLic, 9, "Arial Bold");
   DrawLabel("ZV_VAL_TIME", "ID: " + InpEAId, 20, 120, C'113,113,122', 8);
   ChartRedraw();
}

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

   if(mode==1) return (v<levd) ?  1 : (v>levu) ? -1 : 0;
   if(mode==2) return (v>levm) ?  1 : (v<levm) ? -1 : 0;
   return              (v>levu) ?  1 : (v<levd) ? -1 : 0;
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
