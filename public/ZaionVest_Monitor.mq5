//+------------------------------------------------------------------+
//|                                      ZaionVest_Monitor.mq5       |
//|                                      ZaionVest Monitor - Read    |
//|                                                                 |
//|  Coleta saldo / equity / margem / posicoes / historico e envia  |
//|  para o backend Next.js via WebRequest POST /api/monitor/ingest. |
//|  NAO executa ordens. Somente leitura.                           |
//+------------------------------------------------------------------+
#property copyright "ZaionVest"
#property version   "1.10"
#property strict

input string ApiUrl     = "https://zaionvest.com.br/api/monitor/ingest";
input string ApiKey     = "COLE_SUA_CHAVE_AQUI"; // Chave de Monitoramento Exclusiva
input int    IntervalSec = 2;       // intervalo de envio em segundos
input int    HistoryDays = 30;      // dias de historico fechado a enviar
input bool   VerboseLog  = false;

datetime g_lastHistoryStart = 0;
ulong    g_lastDealTime     = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   EventSetTimer(IntervalSec > 0 ? IntervalSec : 2);
   g_lastHistoryStart = TimeCurrent() - HistoryDays * 86400;
   PrintFormat("[ZaionVest_Monitor] iniciado. URL=%s intervalo=%ds", ApiUrl, IntervalSec);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   }

void OnTimer()
  {
   SendSnapshot();
  }

//+------------------------------------------------------------------+
//| Constroi e envia o payload JSON                                  |
//+------------------------------------------------------------------+
void SendSnapshot()
  {
   string json = BuildPayload();
   string headers = "Content-Type: application/json\r\nX-API-Key: " + ApiKey + "\r\n";
   char post[];
   char result[];
   string result_headers;

   StringToCharArray(json, post, 0, -1, CP_UTF8);
   ArrayResize(post, ArraySize(post) - 1);

   ResetLastError();
   int code = WebRequest("POST", ApiUrl, headers, 5000, post, result, result_headers);
   if(code == -1)
     {
      int err = GetLastError();
      PrintFormat("[ZaionVest_Monitor] WebRequest falhou err=%d. Adicione %s em Tools>Options>Expert Advisors>Allow WebRequest.", err, ApiUrl);
      return;
     }
   string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code != 200)
     {
      PrintFormat("[ZaionVest_Monitor] Erro HTTP %d: %s", code, responseText);
     }
   else if(VerboseLog)
     {
      PrintFormat("[ZaionVest_Monitor] HTTP %d (%d bytes resposta)", code, ArraySize(result));
     }
  }

//+------------------------------------------------------------------+
//| Monta o JSON completo manualmente (MQL5 nao tem JSON nativo)     |
//+------------------------------------------------------------------+
string BuildPayload()
  {
   string s = "{";
   s += "\"account\":" + AccountJson() + ",";
   s += "\"positions\":" + PositionsJson() + ",";
   s += "\"closedTrades\":" + HistoryJson();
   s += "}";
   return s;
  }

//+------------------------------------------------------------------+
//| Soma depositos e saques REAIS de todo o historico da conta.      |
//| Depositos/saques manuais no MT5 sao deals do tipo DEAL_TYPE_      |
//| BALANCE (positivo = deposito, negativo = saque). Varremos o      |
//| historico COMPLETO (nao so os HistoryDays), pois o deposito      |
//| inicial normalmente e antigo.                                    |
//+------------------------------------------------------------------+
void ComputeBalanceOps(double &deposits, double &withdrawals)
  {
   deposits    = 0.0;
   withdrawals = 0.0;
   if(!HistorySelect(0, TimeCurrent()))
      return;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0) continue;
      if(HistoryDealGetInteger(deal, DEAL_TYPE) != DEAL_TYPE_BALANCE) continue;
      double amount = HistoryDealGetDouble(deal, DEAL_PROFIT);
      if(amount >= 0) deposits    += amount;
      else            withdrawals += -amount; // guardamos como valor positivo
     }
  }

string AccountJson()
  {
   long   login    = AccountInfoInteger(ACCOUNT_LOGIN);
   string broker   = AccountInfoString(ACCOUNT_COMPANY);
   string server   = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   long   leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin   = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeM    = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double level    = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   double floating = equity - balance;

   double deposits, withdrawals;
   ComputeBalanceOps(deposits, withdrawals);

   string j = "{";
   j += "\"login\":\"" + IntegerToString(login) + "\",";
   j += "\"broker\":\"" + JsonEscape(broker) + "\",";
   j += "\"server\":\"" + JsonEscape(server) + "\",";
   j += "\"currency\":\"" + JsonEscape(currency) + "\",";
   j += "\"leverage\":" + IntegerToString((int)leverage) + ",";
   j += "\"balance\":" + DoubleToString(balance, 2) + ",";
   j += "\"equity\":" + DoubleToString(equity, 2) + ",";
   j += "\"margin\":" + DoubleToString(margin, 2) + ",";
   j += "\"freeMargin\":" + DoubleToString(freeM, 2) + ",";
   j += "\"marginLevel\":" + DoubleToString(level, 2) + ",";
   j += "\"floatingPnL\":" + DoubleToString(floating, 2) + ",";
   j += "\"deposits\":" + DoubleToString(deposits, 2) + ",";
   j += "\"withdrawals\":" + DoubleToString(withdrawals, 2);
   j += "}";
   return j;
  }

string PositionsJson()
  {
   string j = "[";
   int total = PositionsTotal();
   bool first = true;
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      string symbol  = PositionGetString(POSITION_SYMBOL);
      long   type    = PositionGetInteger(POSITION_TYPE);
      double volume  = PositionGetDouble(POSITION_VOLUME);
      double openP   = PositionGetDouble(POSITION_PRICE_OPEN);
      double curP    = PositionGetDouble(POSITION_PRICE_CURRENT);
      double sl      = PositionGetDouble(POSITION_SL);
      double tp      = PositionGetDouble(POSITION_TP);
      datetime openT = (datetime)PositionGetInteger(POSITION_TIME);
      double profit  = PositionGetDouble(POSITION_PROFIT);
      double swap    = PositionGetDouble(POSITION_SWAP);
      long   magic   = PositionGetInteger(POSITION_MAGIC);
      string comment = PositionGetString(POSITION_COMMENT);

      if(!first) j += ",";
      first = false;
      j += "{";
      j += "\"ticket\":\"" + IntegerToString((long)ticket) + "\",";
      j += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      j += "\"side\":\"" + (type == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
      j += "\"volume\":" + DoubleToString(volume, 2) + ",";
      j += "\"openPrice\":" + DoubleToString(openP, _Digits) + ",";
      j += "\"currentPrice\":" + DoubleToString(curP, _Digits) + ",";
      j += "\"sl\":" + DoubleToString(sl, _Digits) + ",";
      j += "\"tp\":" + DoubleToString(tp, _Digits) + ",";
      j += "\"openTime\":\"" + TimeToIso(openT) + "\",";
      j += "\"profit\":" + DoubleToString(profit, 2) + ",";
      j += "\"swap\":" + DoubleToString(swap, 2) + ",";
      j += "\"magic\":\"" + IntegerToString(magic) + "\",";
      j += "\"comment\":\"" + JsonEscape(comment) + "\"";
      j += "}";
     }
   j += "]";
   return j;
  }

string HistoryJson()
  {
   datetime from = (datetime)g_lastHistoryStart;
   datetime to   = TimeCurrent();
   if(!HistorySelect(from, to))
      return "[]";

   string j = "[";
   bool first = true;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0) continue;

      long entry = HistoryDealGetInteger(deal, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT && entry != DEAL_ENTRY_OUT_BY)
         continue;

      ulong  positionId = (ulong)HistoryDealGetInteger(deal, DEAL_POSITION_ID);
      string symbol     = HistoryDealGetString(deal, DEAL_SYMBOL);
      long   dealType   = HistoryDealGetInteger(deal, DEAL_TYPE);
      double volume     = HistoryDealGetDouble(deal, DEAL_VOLUME);
      double closePrice = HistoryDealGetDouble(deal, DEAL_PRICE);
      datetime closeTime = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
      double profit     = HistoryDealGetDouble(deal, DEAL_PROFIT);
      double commission = HistoryDealGetDouble(deal, DEAL_COMMISSION);
      double swap       = HistoryDealGetDouble(deal, DEAL_SWAP);
      long   magic      = HistoryDealGetInteger(deal, DEAL_MAGIC);
      string comment    = HistoryDealGetString(deal, DEAL_COMMENT);

      // Buscar o deal de entrada do mesmo positionId
      double openPrice = closePrice;
      datetime openTime = closeTime;
      string side = "BUY";
      for(int k = 0; k < total; k++)
        {
         ulong d2 = HistoryDealGetTicket(k);
         if(d2 == 0) continue;
         if((ulong)HistoryDealGetInteger(d2, DEAL_POSITION_ID) != positionId) continue;
         long e2 = HistoryDealGetInteger(d2, DEAL_ENTRY);
         if(e2 == DEAL_ENTRY_IN)
           {
            openPrice = HistoryDealGetDouble(d2, DEAL_PRICE);
            openTime  = (datetime)HistoryDealGetInteger(d2, DEAL_TIME);
            long t2   = HistoryDealGetInteger(d2, DEAL_TYPE);
            side      = (t2 == DEAL_TYPE_BUY ? "BUY" : "SELL");
            break;
           }
        }

      if(!first) j += ",";
      first = false;
      j += "{";
      j += "\"ticket\":\"" + IntegerToString((long)positionId) + "\",";
      j += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      j += "\"side\":\"" + side + "\",";
      j += "\"volume\":" + DoubleToString(volume, 2) + ",";
      j += "\"openPrice\":" + DoubleToString(openPrice, _Digits) + ",";
      j += "\"closePrice\":" + DoubleToString(closePrice, _Digits) + ",";
      j += "\"openTime\":\"" + TimeToIso(openTime) + "\",";
      j += "\"closeTime\":\"" + TimeToIso(closeTime) + "\",";
      j += "\"profit\":" + DoubleToString(profit, 2) + ",";
      j += "\"commission\":" + DoubleToString(commission, 2) + ",";
      j += "\"swap\":" + DoubleToString(swap, 2) + ",";
      j += "\"magic\":\"" + IntegerToString(magic) + "\",";
      j += "\"comment\":\"" + JsonEscape(comment) + "\"";
      j += "}";
     }
   j += "]";
   return j;
  }

string TimeToIso(datetime t)
  {
   MqlDateTime mt;
   TimeToStruct(t, mt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       mt.year, mt.mon, mt.day, mt.hour, mt.min, mt.sec);
  }

string JsonEscape(string s)
  {
   string r = "";
   for(int i = 0; i < StringLen(s); i++)
     {
      ushort c = StringGetCharacter(s, i);
      if(c == '"') r += "\\\"";
      else if(c == '\\') r += "\\\\";
      else if(c == '\n') r += "\\n";
      else if(c == '\r') r += "\\r";
      else if(c == '\t') r += "\\t";
      else r += ShortToString(c);
     }
   return r;
  }
//+------------------------------------------------------------------+
