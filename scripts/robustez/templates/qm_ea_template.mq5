//+------------------------------------------------------------------+
//|  QuantMiner-style EA (ZaionVest) — template                      |
//|  Params baked-in por estratégia. Licença/kill-switch via         |
//|  WebRequest ao endpoint /api/ea/<id>/status. Modelo A.           |
//|  Os tokens __XXX__ são substituídos na compilação (compiler.py). |
//+------------------------------------------------------------------+
#property strict
#property version   "1.00"
#include <Trade/Trade.mqh>

//--- Identidade / licença (substituídos na compilação) ---
input string InpEAId      = "__EA_ID__";      // id do EA na vitrine
input string InpEmail     = "";               // e-mail do assinante (obrigatório)
input string InpStatusUrl = "__STATUS_URL__"; // endpoint de licença
input int    InpFamily    = __FAMILY__;       // 0=trend 1=meanrev 2=breakout
input int    InpExitMode  = __EXIT_MODE__;    // 0=reversal 1=fixed_sltp
input double InpLot       = 0.10;

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

CTrade   trade;
int      hEmaFast=INVALID_HANDLE, hEmaSlow=INVALID_HANDLE, hEmaFilter=INVALID_HANDLE;
int      hRsi=INVALID_HANDLE, hAtr=INVALID_HANDLE;
datetime g_lastLicenseCheck=0;
datetime g_lastGoodLicense=0;
bool     g_licenseOk=true;         // otimista até a 1ª checagem
datetime g_lastBarTime=0;

//+------------------------------------------------------------------+
int OnInit()
{
   if(InpFamily==0)
   {
      hEmaFast   = iMA(_Symbol,_Period,InpEmaFast,0,MODE_EMA,PRICE_CLOSE);
      hEmaSlow   = iMA(_Symbol,_Period,InpEmaSlow,0,MODE_EMA,PRICE_CLOSE);
      hEmaFilter = iMA(_Symbol,_Period,InpEmaFilter,0,MODE_EMA,PRICE_CLOSE);
   }
   else if(InpFamily==1)
      hRsi = iRSI(_Symbol,_Period,InpRsiPeriod,PRICE_CLOSE);

   hAtr = iATR(_Symbol,_Period,InpAtrPeriod);
   g_lastGoodLicense = TimeCurrent();

   if(InpEmail=="")
      Print("QuantMiner: informe seu e-mail de assinante no input InpEmail.");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
double Buf(int handle,int shift)
{
   double b[];
   if(CopyBuffer(handle,0,shift,1,b)<=0) return(0.0);
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
      // Sem contato (URL não liberada ou offline): fail-safe de 24h
      // operando com o último status válido; depois disso, trava.
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
         Alert("QuantMiner: estratégia REPROVADA na revalidação. Troque por outra aprovada na vitrine.");
      else if(StringFind(resp,"no_subscription")>=0)
         Alert("QuantMiner: assinatura inativa/expirada. Renove para continuar operando.");
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
int Signal()
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
      if(ih<0 || il<0) return(0);
      double hh=iHigh(_Symbol,_Period,ih);
      double ll=iLow(_Symbol,_Period,il);
      if(c>hh) return(1);
      if(c<ll) return(-1);
   }
   return(0);
}

//+------------------------------------------------------------------+
int PosDir()
{
   if(!PositionSelect(_Symbol)) return(0);
   long type=PositionGetInteger(POSITION_TYPE);
   return (type==POSITION_TYPE_BUY)?1:-1;
}

//+------------------------------------------------------------------+
void OnTick()
{
   CheckLicense();
   if(!NewBar()) return;

   int dir=PosDir();
   int sig=Signal();

   // Saída por sinal contrário
   if(dir!=0 && sig==-dir)
   {
      trade.PositionClose(_Symbol);
      dir=0;
   }

   // Licença inválida → não abre novas ordens (kill-switch)
   if(!g_licenseOk) return;

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
//+------------------------------------------------------------------+
