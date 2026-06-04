//+------------------------------------------------------------------+
//|                                         TradeVisionBridge.mq5    |
//|                        Trade Vision AI — execução automática     |
//|                        v1.0                                       |
//+------------------------------------------------------------------+
#property copyright "Trade Vision AI"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

input string  ApiBaseUrl = "https://tradevision-app.vercel.app";
input string  ApiToken   = "";        // cole o token gerado em /dashboard/mt5
input int     PollSeconds = 3;        // frequência de polling
input double  RiskVolume  = 0.01;     // volume padrão se a ordem não definir
input bool    AllowMarket = true;
input bool    AllowPending = true;

CTrade  trade;
datetime lastPoll = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(ApiToken) < 10)
   {
      Print("[TradeVision] ApiToken inválido — configure nas opções do EA.");
      return INIT_PARAMETERS_INCORRECT;
   }
   Print("[TradeVision] Bridge ativo. Polling a cada ", PollSeconds, "s.");
   EventSetTimer(PollSeconds);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() { PollPendingOrders(); }

//+------------------------------------------------------------------+
void PollPendingOrders()
{
   string url = ApiBaseUrl + "/api/mt5/poll?token=" + ApiToken;
   string headers = "Content-Type: application/json\r\n";
   char data[];
   char result[];
   string resultHeaders;

   int timeout = 5000;
   int code = WebRequest("GET", url, headers, timeout, data, result, resultHeaders);

   if(code == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("[TradeVision] Adicione o domínio em Ferramentas → Opções → Expert Advisors.");
      else
         Print("[TradeVision] Erro WebRequest poll: ", err);
      return;
   }

   if(code != 200)
   {
      Print("[TradeVision] HTTP poll ", code, " : ", CharArrayToString(result));
      return;
   }

   string body = CharArrayToString(result);
   ProcessOrders(body);
}

//+------------------------------------------------------------------+
void ProcessOrders(string body)
{
   // Parse ingênuo procurando blocos {"id":...,"symbol":...} — simples e estável
   int pos = 0;
   while(true)
   {
      int start = StringFind(body, "{\"id\":", pos);
      if(start < 0) break;
      int end = StringFind(body, "}", start);
      if(end < 0) break;
      string obj = StringSubstr(body, start, end - start + 1);
      pos = end + 1;
      ExecuteOrder(obj);
   }
}

//+------------------------------------------------------------------+
string JsonStr(string body, string key)
{
   string needle = "\"" + key + "\":\"";
   int s = StringFind(body, needle);
   if(s < 0) return "";
   s += StringLen(needle);
   int e = StringFind(body, "\"", s);
   if(e < 0) return "";
   return StringSubstr(body, s, e - s);
}

double JsonNum(string body, string key, double def)
{
   string needle = "\"" + key + "\":";
   int s = StringFind(body, needle);
   if(s < 0) return def;
   s += StringLen(needle);
   // pula null
   if(StringSubstr(body, s, 4) == "null") return def;
   string rest = StringSubstr(body, s, 32);
   double v = StringToDouble(rest);
   return v;
}

//+------------------------------------------------------------------+
void ExecuteOrder(string obj)
{
   string orderId  = JsonStr(obj, "id");
   string symbol   = JsonStr(obj, "symbol");
   string side     = JsonStr(obj, "side");
   string entryType = JsonStr(obj, "entryType");
   double vol      = JsonNum(obj, "volume", RiskVolume);
   double entryPx  = JsonNum(obj, "entryPrice", 0);
   double sl       = JsonNum(obj, "stopLoss", 0);
   double tp       = JsonNum(obj, "takeProfit", 0);
   string comment  = JsonStr(obj, "comment");

   if(orderId == "" || symbol == "") return;
   if(!SymbolSelect(symbol, true))
   {
      Confirm(orderId, 0, "Símbolo " + symbol + " não disponível");
      return;
   }

   bool ok = false;
   ulong ticket = 0;
   string err = "";

   if(entryType == "MARKET" && AllowMarket)
   {
      if(side == "BUY") ok = trade.Buy(vol, symbol, 0, sl, tp, comment);
      else              ok = trade.Sell(vol, symbol, 0, sl, tp, comment);
      ticket = trade.ResultOrder();
      if(!ok) err = trade.ResultRetcodeDescription();
   }
   else if(AllowPending)
   {
      // LIMIT ou STOP
      bool isLimit = (entryType == "LIMIT");
      if(side == "BUY")
         ok = isLimit
            ? trade.BuyLimit(vol, entryPx, symbol, sl, tp, ORDER_TIME_GTC, 0, comment)
            : trade.BuyStop(vol, entryPx, symbol, sl, tp, ORDER_TIME_GTC, 0, comment);
      else
         ok = isLimit
            ? trade.SellLimit(vol, entryPx, symbol, sl, tp, ORDER_TIME_GTC, 0, comment)
            : trade.SellStop(vol, entryPx, symbol, sl, tp, ORDER_TIME_GTC, 0, comment);
      ticket = trade.ResultOrder();
      if(!ok) err = trade.ResultRetcodeDescription();
   }
   else
   {
      err = "Tipo " + entryType + " desabilitado";
   }

   Confirm(orderId, ticket, err);
}

//+------------------------------------------------------------------+
void Confirm(string orderId, ulong ticket, string err)
{
   string url = ApiBaseUrl + "/api/mt5/confirm?token=" + ApiToken;
   string headers = "Content-Type: application/json\r\n";
   string payload;
   if(StringLen(err) > 0)
      payload = "{\"orderId\":\"" + orderId + "\",\"error\":\"" + err + "\"}";
   else
      payload = "{\"orderId\":\"" + orderId + "\",\"mt5Ticket\":" + IntegerToString((long)ticket) + "}";

   char data[];
   StringToCharArray(payload, data, 0, StringLen(payload));
   char result[];
   string resultHeaders;

   int code = WebRequest("POST", url, headers, 5000, data, result, resultHeaders);
   if(code != 200)
      Print("[TradeVision] confirm HTTP ", code, " : ", CharArrayToString(result));
}
//+------------------------------------------------------------------+
