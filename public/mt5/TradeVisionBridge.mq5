//+------------------------------------------------------------------+
//|                                         TradeVisionBridge.mq5    |
//|                Trade Vision AI — Scanner + Bridge + Heartbeat    |
//|                v3.0 — PRODUCTION READY                           |
//+------------------------------------------------------------------+
#property copyright "Trade Vision AI"
#property version   "3.00"
#property strict
#property description "Bridge robusto com validação de ordens, retry e logs"

#include <Trade\Trade.mqh>
#include <Arrays\ArrayString.mqh>

//--- Input Parameters
input group "=== CONEXÃO API ==="
input string  ApiBaseUrl       = "https://tradevision-app.vercel.app";
input string  ApiToken         = "";
input int     RequestTimeout   = 5000;
input int     MaxRetries       = 3;

input group "=== SCANNER ==="
input bool    EnableScanner    = true;
input int     ScanIntervalMin  = 15;
input int     CandlesPerScan   = 1000;      // Velas enviadas por scan (1000 para histórico longo)
input int     HtfCandlesPerScan = 60;

input group "=== BRIDGE (EXECUÇÃO) ==="
input bool    EnableBridge     = true;
input int     PollSeconds      = 3;
input double  DefaultVolume    = 0.01;
input double  MaxVolumePerTrade = 1.0;  // Segurança: volume máximo
input int     MaxTradesPerDay  = 10;    // Limite diário
input double  MaxDailyLossPercent = 5.0; // Max loss diário %
input bool    AllowMarket      = true;
input bool    AllowPending     = true;
input int     Slippage         = 10;

input group "=== HEARTBEAT ==="
input int     HeartbeatSeconds = 10;    // Aumentado para reduzir carga

input group "=== SÍMBOLOS ==="
input string  SymbolSuffix     = "";

//--- Global Variables
CTrade   trade;
datetime lastBeat   = 0;
datetime lastPoll   = 0;
datetime lastWatch  = 0;
datetime dayStart   = 0;
int      tradesToday = 0;
double   dailyStartBalance = 0;
string   watchlistJson = "";
string   processedOrderIds[];  // Evita processar mesma ordem 2x

// Cache de símbolos
string   resolveKeys[];
string   resolveVals[];

//+------------------------------------------------------------------+
//| Símbolo com cache melhorado                                      |
//+------------------------------------------------------------------+
string ResolveSymbol(string base)
{
   if(StringLen(base) == 0) return "";

   // Cache hit
   for(int i = 0; i < ArraySize(resolveKeys); i++)
      if(resolveKeys[i] == base) return resolveVals[i];

   string found = "";

   // 1) Sufixo manual
   if(StringLen(SymbolSuffix) > 0)
   {
      string c = base + SymbolSuffix;
      if(SymbolSelect(c, true)) found = c;
   }

   // 2) Exato
   if(found == "" && SymbolSelect(base, true)) found = base;

   // 3) Sufixos comuns
   if(found == "")
   {
      string suffixes[] = {"xx", "m", ".r", "pro", "_i", ".a", "cent", "x", ".dk", "+", "#", ".ecn"};
      for(int i = 0; i < ArraySize(suffixes) && found == ""; i++)
      {
         string c = base + suffixes[i];
         if(SymbolSelect(c, true)) found = c;
      }
   }

   // 4) Market Watch
   if(found == "")
   {
      int total = SymbolsTotal(true);
      for(int i = 0; i < total && found == ""; i++)
      {
         string sym = SymbolName(i, true);
         if(StringFind(sym, base) == 0) found = sym;
      }
   }

   // 5) Universo total
   if(found == "")
   {
      int total = SymbolsTotal(false);
      for(int i = 0; i < total && found == ""; i++)
      {
         string sym = SymbolName(i, false);
         if(StringFind(sym, base) == 0)
         {
            SymbolSelect(sym, true);
            found = sym;
         }
      }
   }

   // Cache
   int n = ArraySize(resolveKeys);
   ArrayResize(resolveKeys, n + 1);
   ArrayResize(resolveVals, n + 1);
   resolveKeys[n] = base;
   resolveVals[n] = found;

   if(found == "")
      PrintFormat("[TradeVision] ⚠️ Símbolo não encontrado: %s", base);
   else if(found != base)
      PrintFormat("[TradeVision] ✓ %s → %s", base, found);

   return found;
}

//+------------------------------------------------------------------+
//| Init                                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(ApiToken) < 10)
   {
      Print("[TradeVision] ❌ ApiToken inválido — configure nas opções do EA.");
      return INIT_PARAMETERS_INCORRECT;
   }
   
   dayStart = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   dailyStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   tradesToday = 0;
   
   PrintFormat("[TradeVision] v3.0 ativo | Scanner=%s Bridge=%s | Saldo inicial: %.2f",
               EnableScanner ? "ON" : "OFF",
               EnableBridge ? "ON" : "OFF",
               dailyStartBalance);
   
   EventSetTimer(1);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) 
{ 
   EventKillTimer();
   PrintFormat("[TradeVision] EA finalizado. Razão: %d", reason);
}

//+------------------------------------------------------------------+
//| Timer principal                                                  |
//+------------------------------------------------------------------+
void OnTimer()
{
   datetime now = TimeCurrent();
   
   // Reset contadores diários
   datetime today = StringToTime(TimeToString(now, TIME_DATE));
   if(today > dayStart)
   {
      dayStart = today;
      dailyStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      tradesToday = 0;
      PrintFormat("[TradeVision] 📅 Novo dia | Saldo: %.2f", dailyStartBalance);
   }

   // Heartbeat
   if(now - lastBeat >= HeartbeatSeconds)
   {
      SendHeartbeat();
      lastBeat = now;
   }

   // Bridge - polling de ordens
   if(EnableBridge && now - lastPoll >= PollSeconds)
   {
      PollPendingOrders();
      lastPoll = now;
   }

   // Scanner - busca watchlist
   if(EnableScanner && now - lastWatch >= 60)
   {
      FetchWatchlist();
      lastWatch = now;
   }

   // Scanner - executa scans
   if(EnableScanner) 
      ScanWatchlist();
}

//+------------------------------------------------------------------+
//| HEARTBEAT                                                        |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string url = ApiBaseUrl + "/api/mt5/heartbeat?token=" + ApiToken;

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
   
   // Calcular drawdown diário
   double dailyPL = equity - dailyStartBalance;
   double dailyPLPercent = (dailyStartBalance > 0) ? (dailyPL / dailyStartBalance * 100) : 0;

   string ticksPart = BuildTicksArray();

   string payload = StringFormat(
      "{"
      "\"account\":{"
      "\"number\":%I64d,"
      "\"name\":\"%s\","
      "\"server\":\"%s\","
      "\"company\":\"%s\","
      "\"currency\":\"%s\","
      "\"leverage\":%I64d,"
      "\"balance\":%.2f,"
      "\"equity\":%.2f,"
      "\"margin\":%.2f,"
      "\"freeMargin\":%.2f,"
      "\"marginLevel\":%.2f,"
      "\"dailyPL\":%.2f,"
      "\"dailyPLPercent\":%.2f,"
      "\"tradesToday\":%d"
      "},"
      "\"ticks\":%s,"
      "\"timestamp\":\"%s\""
      "}",
      accNum, accName, accServer, accCompany, accCurr,
      lev, balance, equity, mar, freeMar, marLevel,
      dailyPL, dailyPLPercent, tradesToday,
      ticksPart,
      TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
   );

   HttpPostWithRetry(url, payload);
}

//+------------------------------------------------------------------+
string BuildTicksArray()
{
   if(watchlistJson == "") return "[]";
   
   string out = "[";
   bool first = true;
   int pos = 0;
   string seen[];
   
   while(true)
   {
      int s = StringFind(watchlistJson, "\"symbol\":\"", pos);
      if(s < 0) break;
      s += 10;
      int e = StringFind(watchlistJson, "\"", s);
      if(e < 0) break;
      string baseSym = StringSubstr(watchlistJson, s, e - s);
      pos = e + 1;

      string realSym = ResolveSymbol(baseSym);
      if(realSym == "") continue;

      // Dedupe
      bool dup = false;
      for(int i = 0; i < ArraySize(seen); i++) 
         if(seen[i] == realSym) { dup = true; break; }
      if(dup) continue;
      
      int n = ArraySize(seen); 
      ArrayResize(seen, n + 1); 
      seen[n] = realSym;

      MqlTick tk;
      if(!SymbolInfoTick(realSym, tk)) continue;

      if(!first) out += ",";
      out += StringFormat("{\"symbol\":\"%s\",\"bid\":%.5f,\"ask\":%.5f,\"time\":%I64d}", 
                          realSym, tk.bid, tk.ask, (long)tk.time);
      first = false;
   }
   out += "]";
   return out;
}

//+------------------------------------------------------------------+
//| SCANNER                                                          |
//+------------------------------------------------------------------+
void FetchWatchlist()
{
   string url = ApiBaseUrl + "/api/mt5/watchlist?token=" + ApiToken;
   string body = HttpGetWithRetry(url);
   if(StringLen(body) > 0) 
   {
      watchlistJson = body;
      PrintFormat("[TradeVision] 📋 Watchlist atualizada (%d bytes)", StringLen(body));
   }
}

void ScanWatchlist()
{
   if(watchlistJson == "") return;

   int pos = 0;
   int scanned = 0;
   
   while(true)
   {
      int objStart = StringFind(watchlistJson, "{\"id\":", pos);
      if(objStart < 0) break;
      
      // Encontrar o } correspondente (considerando objetos aninhados)
      int objEnd = FindMatchingBrace(watchlistJson, objStart);
      if(objEnd < 0) break;
      
      string item = StringSubstr(watchlistJson, objStart, objEnd - objStart + 1);
      pos = objEnd + 1;

      string id        = JsonStr(item, "id");
      string symbol    = JsonStr(item, "symbol");
      string timeframe = JsonStr(item, "timeframe");
      string mode      = JsonStr(item, "mode");
      string lastScan  = JsonStr(item, "lastScanAt");

      // Respeitar intervalo mínimo
      if(StringLen(lastScan) > 0)
      {
         datetime last = StringToTime(StringSubstr(lastScan, 0, 19));
         if(TimeCurrent() - last < ScanIntervalMin * 60) continue;
      }

      ScanSymbol(id, symbol, timeframe, mode);
      scanned++;
   }
   
   if(scanned > 0)
      PrintFormat("[TradeVision] 🔍 Scans executados: %d", scanned);
}

// Encontrar } correspondente (handle nested objects)
int FindMatchingBrace(string str, int start)
{
   int depth = 0;
   for(int i = start; i < StringLen(str); i++)
   {
      string ch = StringSubstr(str, i, 1);
      if(ch == "{") depth++;
      else if(ch == "}")
      {
         depth--;
         if(depth == 0) return i;
      }
   }
   return -1;
}

void ScanSymbol(string watchId, string symbol, string timeframe, string mode)
{
   string realSym = ResolveSymbol(symbol);
   if(realSym == "") return;
   
   ENUM_TIMEFRAMES tf = TfFromString(timeframe);
   ENUM_TIMEFRAMES htf = HtfOf(tf);

   // LTF candles
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int copied = CopyRates(realSym, tf, 0, CandlesPerScan, rates);
   if(copied < 20)
   {
      PrintFormat("[TradeVision] ⚠️ Velas insuficientes %s %s: %d", realSym, timeframe, copied);
      return;
   }

   string candles = BuildCandlesJson(rates, copied);

   // HTF contexto
   string htfCandles = "[]";
   if(HtfCandlesPerScan > 0)
   {
      MqlRates htfRates[];
      ArraySetAsSeries(htfRates, false);
      int hcopied = CopyRates(realSym, htf, 0, HtfCandlesPerScan, htfRates);
      if(hcopied >= 5)
         htfCandles = BuildCandlesJson(htfRates, hcopied);
   }

   string payload = StringFormat(
      "{"
      "\"watchlistId\":\"%s\","
      "\"symbol\":\"%s\","
      "\"timeframe\":\"%s\","
      "\"mode\":\"%s\","
      "\"candles\":%s,"
      "\"htfCandles\":%s,"
      "\"scannedAt\":\"%s\""
      "}",
      watchId, realSym, timeframe, mode, candles, htfCandles,
      TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
   );

   string url = ApiBaseUrl + "/api/mt5/scan?token=" + ApiToken;
   PrintFormat("[TradeVision] 📊 Scan %s %s %s (%d LTF + %d HTF)", 
               realSym, timeframe, mode, copied, 
               (htfCandles == "[]" ? 0 : HtfCandlesPerScan));
   HttpPostWithRetry(url, payload);
}

string BuildCandlesJson(MqlRates &rates[], int count)
{
   string json = "[";
   for(int i = 0; i < count; i++)
   {
      if(i > 0) json += ",";
      json += StringFormat("{\"t\":%I64d,\"o\":%.5f,\"h\":%.5f,\"l\":%.5f,\"c\":%.5f,\"v\":%I64d}",
                           (long)rates[i].time, rates[i].open, rates[i].high,
                           rates[i].low, rates[i].close, (long)rates[i].tick_volume);
   }
   json += "]";
   return json;
}

ENUM_TIMEFRAMES TfFromString(string s)
{
   if(s == "M1")  return PERIOD_M1;
   if(s == "M5")  return PERIOD_M5;
   if(s == "M15") return PERIOD_M15;
   if(s == "M30") return PERIOD_M30;
   if(s == "H1")  return PERIOD_H1;
   if(s == "H4")  return PERIOD_H4;
   if(s == "D1")  return PERIOD_D1;
   if(s == "W1")  return PERIOD_W1;
   return PERIOD_M15;
}

ENUM_TIMEFRAMES HtfOf(ENUM_TIMEFRAMES tf)
{
   if(tf == PERIOD_M1)  return PERIOD_M15;
   if(tf == PERIOD_M5)  return PERIOD_H1;
   if(tf == PERIOD_M15) return PERIOD_H1;
   if(tf == PERIOD_M30) return PERIOD_H4;
   if(tf == PERIOD_H1)  return PERIOD_H4;
   if(tf == PERIOD_H4)  return PERIOD_D1;
   if(tf == PERIOD_D1)  return PERIOD_W1;
   return PERIOD_H1;
}

//+------------------------------------------------------------------+
//| BRIDGE — Execução com validações                                 |
//+------------------------------------------------------------------+
void PollPendingOrders()
{
   string url = ApiBaseUrl + "/api/mt5/poll?token=" + ApiToken;
   string body = HttpGetWithRetry(url);
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
      
      int end = FindMatchingBrace(body, start);
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
   string reason    = JsonStr(obj, "reason");

   if(orderId == "" || symbol == "") 
   {
      Print("[TradeVision] ❌ Ordem inválida (sem ID ou símbolo)");
      return;
   }

   // Verificar se já processou essa ordem
   if(IsOrderProcessed(orderId))
   {
      PrintFormat("[TradeVision] ⏭️ Ordem %s já processada", orderId);
      return;
   }

   // VALIDAÇÕES DE SEGURANÇA
   string validationError = ValidateOrder(symbol, side, entryType, vol, entryPx, sl, tp);
   if(validationError != "")
   {
      PrintFormat("[TradeVision] ❌ Ordem %s rejeitada: %s", orderId, validationError);
      ConfirmOrder(orderId, 0, validationError);
      MarkOrderProcessed(orderId);
      return;
   }

   string realSym = ResolveSymbol(symbol);
   if(realSym == "" || !SymbolSelect(realSym, true))
   {
      ConfirmOrder(orderId, 0, "Símbolo " + symbol + " indisponível");
      MarkOrderProcessed(orderId);
      return;
   }

   // Ajustar volume para step
   vol = NormalizeVolume(realSym, vol);
   
   // Ajustar SL/TP para stop level
   double stopLevel = SymbolInfoInteger(realSym, SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(realSym, SYMBOL_POINT);
   sl = AdjustStopLoss(realSym, side, entryPx, sl, entryType, stopLevel);
   tp = AdjustTakeProfit(realSym, side, entryPx, tp, entryType, stopLevel);

   bool ok = false;
   ulong ticket = 0;
   string err = "";

   PrintFormat("[TradeVision] 🚀 Executando %s %s %s %.2f lots @ %.5f | SL:%.5f TP:%.5f | %s",
               entryType, side, realSym, vol, entryPx, sl, tp, reason);

   if(entryType == "MARKET" && AllowMarket)
   {
      if(side == "BUY") 
         ok = trade.Buy(vol, realSym, 0, sl, tp, comment);
      else              
         ok = trade.Sell(vol, realSym, 0, sl, tp, comment);
      
      ticket = trade.ResultOrder();
      if(!ok) err = trade.ResultRetcodeDescription();
   }
   else if(AllowPending)
   {
      bool isLimit = (entryType == "LIMIT");
      if(side == "BUY")
         ok = isLimit
            ? trade.BuyLimit(vol, entryPx, realSym, sl, tp, ORDER_TIME_GTC, 0, comment)
            : trade.BuyStop(vol, entryPx, realSym, sl, tp, ORDER_TIME_GTC, 0, comment);
      else
         ok = isLimit
            ? trade.SellLimit(vol, entryPx, realSym, sl, tp, ORDER_TIME_GTC, 0, comment)
            : trade.SellStop(vol, entryPx, realSym, sl, tp, ORDER_TIME_GTC, 0, comment);
      
      ticket = trade.ResultOrder();
      if(!ok) err = trade.ResultRetcodeDescription();
   }
   else
   {
      err = "Tipo " + entryType + " desabilitado no EA";
   }

   if(ok)
   {
      tradesToday++;
      PrintFormat("[TradeVision] ✅ Ordem %s executada | Ticket: %d", orderId, ticket);
   }
   else
   {
      PrintFormat("[TradeVision] ❌ Ordem %s falhou: %s", orderId, err);
   }

   ConfirmOrder(orderId, ticket, err);
   MarkOrderProcessed(orderId);
}

//+------------------------------------------------------------------+
//| VALIDAÇÕES DE SEGURANÇA                                          |
//+------------------------------------------------------------------+
string ValidateOrder(string symbol, string side, string entryType, double vol, 
                     double entryPx, double sl, double tp)
{
   // 1. Limite de trades por dia
   if(tradesToday >= MaxTradesPerDay)
      return StringFormat("Limite de %d trades/dia atingido", MaxTradesPerDay);

   // 2. Drawdown diário
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double dailyLoss = dailyStartBalance - equity;
   double dailyLossPercent = (dailyStartBalance > 0) ? (dailyLoss / dailyStartBalance * 100) : 0;
   
   if(dailyLossPercent >= MaxDailyLossPercent)
      return StringFormat("Drawdown diário %.2f%% >= limite %.2f%%", dailyLossPercent, MaxDailyLossPercent);

   // 3. Volume máximo
   if(vol > MaxVolumePerTrade)
      return StringFormat("Volume %.2f > máximo %.2f", vol, MaxVolumePerTrade);

   // 4. Margem disponível
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   if(freeMargin < 100)  // Mínimo $100 livre
      return StringFormat("Margem livre insuficiente: %.2f", freeMargin);

   // 5. Lado válido
   if(side != "BUY" && side != "SELL")
      return "Lado inválido: " + side;

   // 6. Tipo válido
   if(entryType != "MARKET" && entryType != "LIMIT" && entryType != "STOP")
      return "Tipo inválido: " + entryType;

   // 7. Preço de entrada para pendentes
   if(entryType != "MARKET" && entryPx <= 0)
      return "Preço de entrada inválido para ordem pendente";

   return "";  // Tudo OK
}

double NormalizeVolume(string symbol, double vol)
{
   double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double stepVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   
   vol = MathMax(minVol, vol);
   vol = MathMin(maxVol, vol);
   vol = MathRound(vol / stepVol) * stepVol;
   
   return NormalizeDouble(vol, 2);
}

double AdjustStopLoss(string symbol, string side, double entryPx, double sl, 
                      string entryType, double stopLevel)
{
   if(sl == 0) return 0;
   
   double currentPrice = (side == "BUY") ? 
                         SymbolInfoDouble(symbol, SYMBOL_ASK) : 
                         SymbolInfoDouble(symbol, SYMBOL_BID);
   
   double refPrice = (entryType == "MARKET") ? currentPrice : entryPx;
   
   if(side == "BUY")
   {
      if(sl >= refPrice - stopLevel)
         sl = refPrice - stopLevel - SymbolInfoDouble(symbol, SYMBOL_POINT);
   }
   else
   {
      if(sl <= refPrice + stopLevel)
         sl = refPrice + stopLevel + SymbolInfoDouble(symbol, SYMBOL_POINT);
   }
   
   return NormalizeDouble(sl, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS));
}

double AdjustTakeProfit(string symbol, string side, double entryPx, double tp, 
                        string entryType, double stopLevel)
{
   if(tp == 0) return 0;
   
   double currentPrice = (side == "BUY") ? 
                         SymbolInfoDouble(symbol, SYMBOL_ASK) : 
                         SymbolInfoDouble(symbol, SYMBOL_BID);
   
   double refPrice = (entryType == "MARKET") ? currentPrice : entryPx;
   
   if(side == "BUY")
   {
      if(tp <= refPrice + stopLevel)
         tp = refPrice + stopLevel + SymbolInfoDouble(symbol, SYMBOL_POINT);
   }
   else
   {
      if(tp >= refPrice - stopLevel)
         tp = refPrice - stopLevel - SymbolInfoDouble(symbol, SYMBOL_POINT);
   }
   
   return NormalizeDouble(tp, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS));
}

bool IsOrderProcessed(string orderId)
{
   for(int i = 0; i < ArraySize(processedOrderIds); i++)
      if(processedOrderIds[i] == orderId) return true;
   return false;
}

void MarkOrderProcessed(string orderId)
{
   int n = ArraySize(processedOrderIds);
   ArrayResize(processedOrderIds, n + 1);
   processedOrderIds[n] = orderId;
   
   // Limpar cache antigo (manter últimos 1000)
   if(n > 1000)
   {
      string temp[];
      ArrayCopy(temp, processedOrderIds, 0, 500);
      ArrayResize(processedOrderIds, ArraySize(temp));
      ArrayCopy(processedOrderIds, temp);
   }
}

void ConfirmOrder(string orderId, ulong ticket, string err)
{
   string url = ApiBaseUrl + "/api/mt5/confirm?token=" + ApiToken;
   string payload;
   
   if(StringLen(err) > 0)
      payload = StringFormat("{\"orderId\":\"%s\",\"error\":\"%s\"}", orderId, err);
   else
      payload = StringFormat("{\"orderId\":\"%s\",\"mt5Ticket\":%I64d}", orderId, (long)ticket);
   
   HttpPostWithRetry(url, payload);
}

//+------------------------------------------------------------------+
//| HTTP com retry                                                   |
//+------------------------------------------------------------------+
string HttpGetWithRetry(string url)
{
   for(int attempt = 1; attempt <= MaxRetries; attempt++)
   {
      string result = HttpGet(url);
      if(StringLen(result) > 0) return result;
      
      if(attempt < MaxRetries)
      {
         PrintFormat("[TradeVision] 🔄 Retry %d/%d GET %s", attempt, MaxRetries, url);
         Sleep(1000 * attempt);  // Backoff
      }
   }
   return "";
}

void HttpPostWithRetry(string url, string payload)
{
   for(int attempt = 1; attempt <= MaxRetries; attempt++)
   {
      int code = HttpPost(url, payload);
      if(code == 200 || code == 201) return;
      
      if(attempt < MaxRetries)
      {
         PrintFormat("[TradeVision] 🔄 Retry %d/%d POST %s (HTTP %d)", attempt, MaxRetries, url, code);
         Sleep(1000 * attempt);
      }
   }
   PrintFormat("[TradeVision] ❌ Falha após %d tentativas: %s", MaxRetries, url);
}

string HttpGet(string url)
{
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + ApiToken + "\r\n";
   string resultHeaders;
   
   ResetLastError();
   int code = WebRequest("GET", url, headers, RequestTimeout, data, result, resultHeaders);
   
   if(code == -1)
   {
      int err = GetLastError();
      if(err == 4014) 
         PrintFormat("[TradeVision] ⚠️ Adicione %s em Opções → Expert Advisors → URLs permitidas", ApiBaseUrl);
      else 
         PrintFormat("[TradeVision] ❌ GET %s erro %d", url, err);
      return "";
   }
   
   if(code != 200) 
   {
      PrintFormat("[TradeVision] ⚠️ GET HTTP %d: %s", code, url);
      return "";
   }
   
   return CharArrayToString(result);
}

int HttpPost(string url, string payload)
{
   char data[];
   StringToCharArray(payload, data, 0, StringLen(payload));
   char result[];
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + ApiToken + "\r\n";
   string resultHeaders;
   
   ResetLastError();
   int code = WebRequest("POST", url, headers, RequestTimeout, data, result, resultHeaders);
   
   if(code == -1)
   {
      int err = GetLastError();
      if(err == 4014) 
         PrintFormat("[TradeVision] ⚠️ Adicione %s em Opções → Expert Advisors → URLs permitidas", ApiBaseUrl);
      else 
         PrintFormat("[TradeVision] ❌ POST %s erro %d", url, err);
      return -1;
   }
   
   if(code != 200 && code != 201) 
      PrintFormat("[TradeVision] ⚠️ POST HTTP %d: %s | Response: %s", code, url, CharArrayToString(result));
   
   return code;
}

//+------------------------------------------------------------------+
//| JSON helpers (melhorados)                                        |
//+------------------------------------------------------------------+
string JsonStr(string body, string key)
{
   string needle = "\"" + key + "\":\"";
   int s = StringFind(body, needle);
   if(s < 0) return "";
   s += StringLen(needle);
   
   // Encontrar aspas final (handle escapes)
   int e = s;
   while(e < StringLen(body))
   {
      string ch = StringSubstr(body, e, 1);
      if(ch == "\"")
      {
         // Verificar se não está escapada
         if(e > 0 && StringSubstr(body, e-1, 1) == "\\")
         {
            e++;
            continue;
         }
         break;
      }
      e++;
   }
   
   if(e <= s) return "";
   return StringSubstr(body, s, e - s);
}

double JsonNum(string body, string key, double def)
{
   string needle = "\"" + key + "\":";
   int s = StringFind(body, needle);
   if(s < 0) return def;
   s += StringLen(needle);
   
   // Pular espaços
   while(s < StringLen(body) && StringSubstr(body, s, 1) == " ") s++;
   
   if(StringSubstr(body, s, 4) == "null") return def;
   
   // Extrair número (pode ter até 50 chars)
   string numStr = "";
   int i = s;
   while(i < StringLen(body) && i < s + 50)
   {
      string ch = StringSubstr(body, i, 1);
      if(StringFind("0123456789.-", ch) >= 0)
         numStr += ch;
      else
         break;
      i++;
   }
   
   if(StringLen(numStr) == 0) return def;
   return StringToDouble(numStr);
}
//+------------------------------------------------------------------+
