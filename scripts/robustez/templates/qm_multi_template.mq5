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
void OnTick()
{
   CheckLicense();
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
