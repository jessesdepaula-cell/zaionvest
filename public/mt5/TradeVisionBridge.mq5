//+------------------------------------------------------------------+
//|                                         TradeVisionBridge.mq5    |
//|                Trade Vision AI — Scanner + Bridge + Heartbeat    |
//|                v2.0                                               |
//+------------------------------------------------------------------+
#property copyright "Trade Vision AI"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>

input string  ApiBaseUrl       = "https://tradevision-app.vercel.app";
input string  ApiToken         = "";        // cole o token gerado em /dashboard/mt5
input bool    EnableScanner    = true;      // escaneia watchlist e envia OHLC pra análise IA
input bool    EnableBridge     = true;      // executa ordens enviadas pelo dashboard
input int     HeartbeatSeconds = 5;         // envia info da conta e ticks
input int     PollSeconds      = 3;         // polling da fila de ordens (Bridge)
input int     ScanIntervalMin  = 15;        // mínimo entre scans do mesmo símbolo
input int     CandlesPerScan   = 100;       // velas enviadas por scan
input double  DefaultVolume    = 0.01;
input bool    AllowMarket      = true;
input bool    AllowPending     = true;

CTrade   trade;
datetime lastBeat   = 0;
datetime lastPoll   = 0;
datetime lastWatch  = 0;
string   watchlistJson = "";

//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(ApiToken) < 10)
   {
      Print("[TradeVision] ApiToken inválido — configure nas opções do EA.");
      return INIT_PARAMETERS_INCORRECT;
   }
   Print("[TradeVision] v2.0 ativo. Scanner=", EnableScanner, " Bridge=", EnableBridge);
   EventSetTimer(1);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }

//+------------------------------------------------------------------+
void OnTimer()
{
   datetime now = TimeCurrent();

   if(now - lastBeat >= HeartbeatSeconds)
   {
      SendHeartbeat();
      lastBeat = now;
   }

   if(EnableBridge && now - lastPoll >= PollSeconds)
   {
      PollPendingOrders();
      lastPoll = now;
   }

   if(EnableScanner && now - lastWatch >= 60)
   {
      FetchWatchlist();
      lastWatch = now;
   }

   if(EnableScanner) ScanWatchlist();
}

//+------------------------------------------------------------------+
//| HEARTBEAT — envia dados da conta + ticks                         |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string url = ApiBaseUrl + "/api/mt5/heartbeat?token=" + ApiToken;

   // conta
   long   accNum     = AccountInfoInteger(ACCOUNT_LOGIN);
   string accName    = AccountInfoString(ACCOUNT_NAME);
   string accServer  = AccountInfoString(ACCOUNT_SERVER);
   string accCompany = AccountInfoString(ACCOUNT_COMPANY);
   string accCurr    = AccountInfoString(ACCOUNT_CURRENCY);
   long   lev        = AccountInfoInteger(ACCOUNT_LEVERAGE);
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double mar        = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMar    = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marLevel   = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);

   string ticksPart = BuildTicksArray();

   string payload = StringFormat(
      "{\"account\":{\"number\":%I64d,\"name\":\"%s\",\"server\":\"%s\",\"company\":\"%s\","
      "\"currency\":\"%s\",\"leverage\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,"
      "\"freeMargin\":%.2f,\"marginLevel\":%.2f},\"ticks\":%s}",
      accNum, accName, accServer, accCompany, accCurr,
      lev, balance, equity, mar, freeMar, marLevel, ticksPart
   );

   HttpPost(url, payload);
}

//+------------------------------------------------------------------+
string BuildTicksArray()
{
   if(watchlistJson == "") return "[]";
   string out = "[";
   bool first = true;
   int pos = 0;
   while(true)
   {
      int s = StringFind(watchlistJson, "\"symbol\":\"", pos);
      if(s < 0) break;
      s += 10;
      int e = StringFind(watchlistJson, "\"", s);
      if(e < 0) break;
      string sym = StringSubstr(watchlistJson, s, e - s);
      pos = e + 1;

      if(!SymbolSelect(sym, true)) continue;
      MqlTick tk;
      if(!SymbolInfoTick(sym, tk)) continue;

      if(!first) out += ",";
      out += StringFormat("{\"symbol\":\"%s\",\"bid\":%.5f,\"ask\":%.5f}", sym, tk.bid, tk.ask);
      first = false;
   }
   out += "]";
   return out;
}

//+------------------------------------------------------------------+
//| SCANNER — busca watchlist e envia OHLC pra análise               |
//+------------------------------------------------------------------+
void FetchWatchlist()
{
   string url = ApiBaseUrl + "/api/mt5/watchlist?token=" + ApiToken;
   string body = HttpGet(url);
   if(StringLen(body) > 0) watchlistJson = body;
}

void ScanWatchlist()
{
   if(watchlistJson == "") return;

   int pos = 0;
   while(true)
   {
      int objStart = StringFind(watchlistJson, "{\"id\":", pos);
      if(objStart < 0) break;
      int objEnd = StringFind(watchlistJson, "}", objStart);
      if(objEnd < 0) break;
      string item = StringSubstr(watchlistJson, objStart, objEnd - objStart + 1);
      pos = objEnd + 1;

      string id        = JsonStr(item, "id");
      string symbol    = JsonStr(item, "symbol");
      string timeframe = JsonStr(item, "timeframe");
      string mode      = JsonStr(item, "mode");
      string lastScan  = JsonStr(item, "lastScanAt");

      // pula se scaneou recentemente
      if(StringLen(lastScan) > 0)
      {
         datetime last = StringToTime(StringSubstr(lastScan, 0, 19));
         if(TimeCurrent() - last < ScanIntervalMin * 60) continue;
      }

      ScanSymbol(id, symbol, timeframe, mode);
   }
}

void ScanSymbol(string watchId, string symbol, string timeframe, string mode)
{
   if(!SymbolSelect(symbol, true)) return;
   ENUM_TIMEFRAMES tf = TfFromString(timeframe);

   MqlRates rates[];
   int copied = CopyRates(symbol, tf, 0, CandlesPerScan, rates);
   if(copied < 20) return;

   string candles = "[";
   for(int i = 0; i < copied; i++)
   {
      if(i > 0) candles += ",";
      candles += StringFormat("{\"t\":%I64d,\"o\":%.5f,\"h\":%.5f,\"l\":%.5f,\"c\":%.5f}",
                              (long)rates[i].time, rates[i].open, rates[i].high,
                              rates[i].low, rates[i].close);
   }
   candles += "]";

   string payload = StringFormat(
      "{\"watchlistId\":\"%s\",\"symbol\":\"%s\",\"timeframe\":\"%s\",\"mode\":\"%s\",\"candles\":%s}",
      watchId, symbol, timeframe, mode, candles
   );

   string url = ApiBaseUrl + "/api/mt5/scan?token=" + ApiToken;
   HttpPost(url, payload);
}

ENUM_TIMEFRAMES TfFromString(string s)
{
   if(s == "M5")  return PERIOD_M5;
   if(s == "M15") return PERIOD_M15;
   if(s == "M30") return PERIOD_M30;
   if(s == "H1")  return PERIOD_H1;
   if(s == "H4")  return PERIOD_H4;
   if(s == "D1")  return PERIOD_D1;
   return PERIOD_M15;
}

//+------------------------------------------------------------------+
//| BRIDGE — ordens vindas do dashboard                              |
//+------------------------------------------------------------------+
void PollPendingOrders()
{
   string url = ApiBaseUrl + "/api/mt5/poll?token=" + ApiToken;
   string body = HttpGet(url);
   if(StringLen(body) == 0) return;
   ProcessOrders(body);
}

void ProcessOrders(string body)
{
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

void ExecuteOrder(string obj)
{
   string orderId   = JsonStr(obj, "id");
   string symbol    = JsonStr(obj, "symbol");
   string side      = JsonStr(obj, "side");
   string entryType = JsonStr(obj, "entryType");
   double vol       = JsonNum(obj, "volume", DefaultVolume);
   double entryPx   = JsonNum(obj, "entryPrice", 0);
   double sl        = JsonNum(obj, "stopLoss", 0);
   double tp        = JsonNum(obj, "takeProfit", 0);
   string comment   = JsonStr(obj, "comment");

   if(orderId == "" || symbol == "") return;
   if(!SymbolSelect(symbol, true))
   {
      ConfirmOrder(orderId, 0, "Símbolo " + symbol + " indisponível");
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
      err = "Tipo " + entryType + " desabilitado no EA";
   }

   ConfirmOrder(orderId, ticket, err);
}

void ConfirmOrder(string orderId, ulong ticket, string err)
{
   string url = ApiBaseUrl + "/api/mt5/confirm?token=" + ApiToken;
   string payload;
   if(StringLen(err) > 0)
      payload = "{\"orderId\":\"" + orderId + "\",\"error\":\"" + err + "\"}";
   else
      payload = "{\"orderId\":\"" + orderId + "\",\"mt5Ticket\":" + IntegerToString((long)ticket) + "}";
   HttpPost(url, payload);
}

//+------------------------------------------------------------------+
//| HTTP helpers                                                      |
//+------------------------------------------------------------------+
string HttpGet(string url)
{
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   string resultHeaders;
   int code = WebRequest("GET", url, headers, 5000, data, result, resultHeaders);
   if(code == -1)
   {
      int err = GetLastError();
      if(err == 4014) Print("[TradeVision] Adicione ", ApiBaseUrl, " em Opções → Expert Advisors.");
      else Print("[TradeVision] GET ", url, " erro ", err);
      return "";
   }
   if(code != 200) { Print("[TradeVision] GET HTTP ", code); return ""; }
   return CharArrayToString(result);
}

void HttpPost(string url, string payload)
{
   char data[];
   StringToCharArray(payload, data, 0, StringLen(payload));
   char result[];
   string headers = "Content-Type: application/json\r\n";
   string resultHeaders;
   int code = WebRequest("POST", url, headers, 8000, data, result, resultHeaders);
   if(code == -1)
   {
      int err = GetLastError();
      if(err == 4014) Print("[TradeVision] Adicione ", ApiBaseUrl, " em Opções → Expert Advisors.");
      else Print("[TradeVision] POST erro ", err);
   }
   else if(code != 200) Print("[TradeVision] POST HTTP ", code, " body: ", CharArrayToString(result));
}

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
   if(StringSubstr(body, s, 4) == "null") return def;
   return StringToDouble(StringSubstr(body, s, 32));
}
//+------------------------------------------------------------------+
