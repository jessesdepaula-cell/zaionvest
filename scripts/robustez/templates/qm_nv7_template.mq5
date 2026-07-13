//+------------------------------------------------------------------+
//|  ZaionVest EA (Modelo A) — Zaion Sniper (NV7)                    |
//|  Grid Fibonacci Hedgeado com Painel Gráfico (Dashboard) em tela  |
//|  e verificação de licença via WebRequest.                        |
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

//--- Parâmetros do Operacional NV7 ---
input int    InpSwingBars   = __SWING_BARS__;   // N barras do Swing do canal
input double InpFibLowPct   = __FIB_LOW_PCT__;  // Retração mínima (ex: 38.2)
input double InpFibHighPct  = __FIB_HIGH_PCT__; // Retração máxima (ex: 50.0)
input int    InpAtrPeriod   = __ATR_PERIOD__;   // Período ATR
input double InpGridStep    = __GRID_STEP__;    // Distância do Grid em ATRs
input double InpTpAtr       = __TP_ATR__;       // TP de cesto em ATRs
input int    InpMaxLvl      = __MAX_POSITIONS__;// Máx. níveis de grid por lado
input double InpDdGuard     = __DD_GUARD_PCT__; // DD-guard por lado (% do capital)
input double InpMaxDdPct    = __MAX_DD_PCT__;   // Max DD da conta (% de stop)
input int    InpClusterMin  = __CLUSTER_MIN__;  // Mín. posições para cluster-netting
input double InpClusterNet  = __CLUSTER_NET_ATR__; // Lucro mín. cluster (ATRs)

CTrade   trade;
int      hAtr=INVALID_HANDLE;
datetime g_lastLicenseCheck=0;
datetime g_lastGoodLicense=0;
bool     g_licenseOk=true;
datetime g_lastBarTime=0;
int      g_cooldown=0;

// Arrays de posições abertas
double   g_longs[];
double   g_shorts[];
int      g_totalLongs=0;
int      g_totalShorts=0;

//+------------------------------------------------------------------+
//| Helpers de Dashboard Gráfico                                     |
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

void UpdateDashboard()
{
   // 1. Coleta dados
   double daily = GetProfit(TimeCurrent() - (TimeCurrent() % 86400));
   double weekly = GetProfit(TimeCurrent() - (TimeCurrent() % (86400 * 7)));
   double total = GetProfit(0);
   double floating = GetFloatingProfit();
   
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   double dd = (bal > 0) ? ((bal - eq) / bal * 100.0) : 0.0;
   
   color cDaily = (daily >= 0) ? C'16,185,129' : C'244,63,94';
   color cTotal = (total >= 0) ? C'16,185,129' : C'244,63,94';
   color cLic = g_licenseOk ? C'16,185,129' : C'244,63,94';
   string sLic = g_licenseOk ? "LICENCA ATIVA" : "SEM LICENCA / INATIVO";

   // 2. Desenha fundo
   DrawBg("ZV_BG", 10, 10, 240, 240, C'10,10,10', C'37,99,235');
   
   // 3. Cabecalho
   DrawLabel("ZV_HEADER", "ZAION SNIPER", 20, 20, C'245,245,245', 10, "Arial Bold");
   DrawLabel("ZV_SUB", "Mag: " + (string)InpMagic + " | " + _Symbol + "," + TimeframeToString(_Period), 20, 38, C'113,113,122', 8);
   
   // 4. Lucros
   DrawLabel("ZV_L_LUCROS", "LUCROS", 20, 60, C'113,113,122', 8, "Arial Bold");
   DrawLabel("ZV_VAL_DAILY", "Diario: $" + DoubleToString(daily, 2), 20, 75, cDaily, 9);
   DrawLabel("ZV_VAL_WEEK", "Semanal: $" + DoubleToString(weekly, 2), 20, 90, C'200,200,200', 9);
   DrawLabel("ZV_VAL_TOTAL", "Total: $" + DoubleToString(total, 2), 20, 105, cTotal, 9);
   
   // 5. Exposicao e Risco
   DrawLabel("ZV_L_RISK", "EXPOSICAO E RISCO", 20, 130, C'113,113,122', 8, "Arial Bold");
   DrawLabel("ZV_VAL_POS", "Posicoes: L: " + (string)g_totalLongs + " | S: " + (string)g_totalShorts, 20, 145, C'200,200,200', 9);
   DrawLabel("ZV_VAL_FLOAT", "Flutuante: $" + DoubleToString(floating, 2), 20, 160, (floating >= 0 ? C'16,185,129' : C'244,63,94'), 9);
   DrawLabel("ZV_VAL_DD", "Drawdown Conta: " + DoubleToString(dd, 1) + "%", 20, 175, (dd > 15.0 ? C'244,63,94' : C'200,200,200'), 9);
   
   // 6. Rodape e Status
   DrawBg("ZV_LINE", 20, 198, 220, 1, C'30,30,30', C'30,30,30');
   DrawLabel("ZV_VAL_LIC", sLic, 20, 205, cLic, 9, "Arial Bold");
   DrawLabel("ZV_VAL_TIME", "Atualizado: " + TimeToString(TimeLocal(), TIME_SECONDS), 20, 222, C'113,113,122', 8);
   
   ChartRedraw();
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

//+------------------------------------------------------------------+
//| Helpers de historico e lucros                                    |
//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
//| Licenca e WebRequest                                             |
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
   if(StringFind(resp,"\"valid\":true")>=0)
   {
      g_licenseOk = true;
      g_lastGoodLicense = TimeCurrent();
   }
   else
   {
      g_licenseOk = false;
      if(StringFind(resp,"ea_rejected")>=0)
         Alert("ZaionVest: estrategia REPROVADA na revalidacao. Troque por outra aprovada na vitrine.");
      else if(StringFind(resp,"no_subscription")>=0)
         Alert("ZaionVest: assinatura inativa/expirada. Renove para continuar operando.");
   }
}

//+------------------------------------------------------------------+
//| Gestao de posicoes do Grid                                       |
//+------------------------------------------------------------------+
void UpdatePositions()
{
   g_totalLongs = 0;
   g_totalShorts = 0;
   ArrayResize(g_longs, 0);
   ArrayResize(g_shorts, 0);
   
   for(int i=PositionsTotal()-1; i>=0; i--)
   {
      string sym = PositionGetSymbol(i);
      if(sym == _Symbol)
      {
         ulong magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == InpMagic)
         {
            long type = PositionGetInteger(POSITION_TYPE);
            double pr = PositionGetDouble(POSITION_PRICE_OPEN);
            if(type == POSITION_TYPE_BUY)
            {
               g_totalLongs++;
               ArrayResize(g_longs, g_totalLongs);
               g_longs[g_totalLongs-1] = pr;
            }
            else if(type == POSITION_TYPE_SELL)
            {
               g_totalShorts++;
               ArrayResize(g_shorts, g_totalShorts);
               g_shorts[g_totalShorts-1] = pr;
            }
         }
      }
   }
}

void CloseBasket(int side)
{
   for(int i=PositionsTotal()-1; i>=0; i--)
   {
      string sym = PositionGetSymbol(i);
      if(sym == _Symbol)
      {
         ulong magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == InpMagic)
         {
            long type = PositionGetInteger(POSITION_TYPE);
            if((side == 1 && type == POSITION_TYPE_BUY) || (side == -1 && type == POSITION_TYPE_SELL) || side == 0)
            {
               ulong ticket = PositionGetInteger(POSITION_TICKET);
               trade.PositionClose(ticket);
            }
         }
      }
   }
}

double BasketProfit(int side, double px)
{
   double p = 0;
   double val = InpLot * 100000.0; // Standard Contract Size default
   double targetSymVal = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   if(targetSymVal > 0) val = InpLot * targetSymVal;
   
   if(side == 1)
   {
      for(int i=0; i<g_totalLongs; i++) p += (px - g_longs[i]) * val;
   }
   else if(side == -1)
   {
      for(int i=0; i<g_totalShorts; i++) p += (g_shorts[i] - px) * val;
   }
   return p;
}

//+------------------------------------------------------------------+
//| Inicializacao                                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(InpMagic);
   hAtr = iATR(_Symbol,_Period,InpAtrPeriod);
   g_lastGoodLicense = TimeCurrent();
   
   if(InpEmail=="")
      Print("ZaionVest: informe seu e-mail de assinante no input InpEmail.");
      
   UpdatePositions();
   UpdateDashboard();
   
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   // Limpa objetos graficos ao remover o robo do grafico
   ObjectsDeleteAll(0, "ZV_");
}

//+------------------------------------------------------------------+
//| Desenha as linhas de Fibonacci e a Regiao Amarela no Grafico     |
//+------------------------------------------------------------------+
void DrawFiboGraphics(double hi, double lo, double z_hi, double z_lo, int highestIdx, int lowestIdx)
{
   datetime t_start = iTime(_Symbol, _Period, MathMax(highestIdx, lowestIdx));
   datetime t_end   = TimeCurrent() + PeriodSeconds(_Period) * 10; // Projeta um pouco a frente
   
   // 1. Caixa Amarela / Laranja Translúcida (Zona de Fibonacci)
   string rectName = "ZV_FIBO_RECT";
   if(ObjectFind(0, rectName) < 0)
   {
      ObjectCreate(0, rectName, OBJ_RECTANGLE, 0, t_start, z_hi, t_end, z_lo);
      ObjectSetInteger(0, rectName, OBJPROP_COLOR, C'245,158,11'); // Amber
      ObjectSetInteger(0, rectName, OBJPROP_FILL, true);
      ObjectSetInteger(0, rectName, OBJPROP_BACK, true); // Fundo
      ObjectSetInteger(0, rectName, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, rectName, OBJPROP_HIDDEN, true);
   }
   else
   {
      ObjectSetInteger(0, rectName, OBJPROP_TIME, 0, t_start);
      ObjectSetDouble(0, rectName, OBJPROP_PRICE, 0, z_hi);
      ObjectSetInteger(0, rectName, OBJPROP_TIME, 1, t_end);
      ObjectSetDouble(0, rectName, OBJPROP_PRICE, 1, z_lo);
   }
   
   // 2. Linhas do Canal
   double levels[6] = { hi, hi - 0.236*(hi-lo), z_hi, z_lo, hi - 0.618*(hi-lo), lo };
   color colors[6] = { C'120,120,120', C'80,80,80', C'217,119,6', C'217,119,6', C'80,80,80', C'120,120,120' };
   
   for(int i=0; i<6; i++)
   {
      string name = "ZV_FIBO_L_" + (string)i;
      if(ObjectFind(0, name) < 0)
      {
         ObjectCreate(0, name, OBJ_TREND, 0, t_start, levels[i], t_end, levels[i]);
         ObjectSetInteger(0, name, OBJPROP_COLOR, colors[i]);
         ObjectSetInteger(0, name, OBJPROP_STYLE, (i==2 || i==3) ? STYLE_SOLID : STYLE_DOT);
         ObjectSetInteger(0, name, OBJPROP_BACK, true);
         ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, true);
         ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      }
      else
      {
         ObjectSetInteger(0, name, OBJPROP_TIME, 0, t_start);
         ObjectSetDouble(0, name, OBJPROP_PRICE, 0, levels[i]);
         ObjectSetInteger(0, name, OBJPROP_TIME, 1, t_end);
         ObjectSetDouble(0, name, OBJPROP_PRICE, 1, levels[i]);
      }
   }
}

//+------------------------------------------------------------------+
//| Loop Principal (Tick)                                            |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. Licenca / Fail-Safe
   CheckLicense();
   if(!g_licenseOk)
   {
      CloseBasket(0);
      UpdateDashboard();
      return;
   }
   
   // 2. Cooldown
   if(g_cooldown > 0)
   {
      g_cooldown--;
      UpdateDashboard();
      return;
   }
   
   // 3. Atualiza estado
   UpdatePositions();
   
   double px = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double a = 0.0;
   double atrBuf[];
   if(CopyBuffer(hAtr, 0, 0, 1, atrBuf) > 0) a = atrBuf[0];
   
   if(a <= 0) {
      UpdateDashboard();
      return;
   }

   // 4. Checagem de Drawdown Maximo da Conta
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   if(bal > 0 && (bal - eq) / bal * 100.0 >= InpMaxDdPct)
   {
      CloseBasket(0);
      g_cooldown = 30; // 30 ticks/barras de pausa de seguranca
      UpdateDashboard();
      return;
   }

   // 5. DD-Guard por lado
   double lf = BasketProfit(1, px);
   double sf = BasketProfit(-1, px);
   double cap = AccountInfoDouble(ACCOUNT_BALANCE);
   
   if(g_totalLongs > 0 && lf < -InpDdGuard / 100.0 * cap)
   {
      CloseBasket(1);
      g_totalLongs = 0;
   }
   if(g_totalShorts > 0 && sf < -InpDdGuard / 100.0 * cap)
   {
      CloseBasket(-1);
      g_totalShorts = 0;
   }

   // 6. Cluster-Netting (Fechamento Coletivo de Balanco)
   int tot = g_totalLongs + g_totalShorts;
   double net = lf + sf;
   double value = InpLot * SymbolInfoDouble(_Symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   if(tot >= InpClusterMin && net >= InpClusterNet * a * value)
   {
      CloseBasket(0);
      g_totalLongs = 0;
      g_totalShorts = 0;
   }

   // 7. TP por Lado (Netting)
   if(g_totalLongs > 0 && lf >= InpTpAtr * a * value)
   {
      CloseBasket(1);
      g_totalLongs = 0;
   }
   if(g_totalShorts > 0 && sf >= InpTpAtr * a * value)
   {
      CloseBasket(-1);
      g_totalShorts = 0;
   }

   // 8. Checagem de Nova Barra
   datetime t = iTime(_Symbol, _Period, 0);
   bool newBar = (t != g_lastBarTime);
   if(newBar) g_lastBarTime = t;

   // 9. Zona de Fibonacci
   // Apenas recalcula o canal se for nova barra
   int highestIdx = iHighest(_Symbol, _Period, MODE_HIGH, InpSwingBars, 1);
   int lowestIdx  = iLowest(_Symbol, _Period, MODE_LOW, InpSwingBars, 1);
   double hi = iHigh(_Symbol, _Period, highestIdx);
   double lo = iLow(_Symbol, _Period, lowestIdx);
   double rng = hi - lo;
   
   double z_hi = hi - (InpFibLowPct / 100.0) * rng;
   double z_lo = hi - (InpFibHighPct / 100.0) * rng;
   bool inZone = (px >= z_lo && px <= z_hi);
   
   DrawFiboGraphics(hi, lo, z_hi, z_lo, highestIdx, lowestIdx);

   // 10. Executa Grade / Grid de Niveis contra a ultima entrada
   if(g_totalLongs > 0 && g_totalLongs < InpMaxLvl)
   {
      double lastLongPr = g_longs[g_totalLongs-1];
      if(px <= lastLongPr - InpGridStep * a)
      {
         trade.Buy(InpLot, _Symbol, ask, 0, 0, "ZV Sniper Long");
      }
   }
   if(g_totalShorts > 0 && g_totalShorts < InpMaxLvl)
   {
      double lastShortPr = g_shorts[g_totalShorts-1];
      if(px >= lastShortPr + InpGridStep * a)
      {
         trade.Sell(InpLot, _Symbol, px, 0, 0, "ZV Sniper Short");
      }
   }

   // 11. Abertura do Hedge Principal ao entrar na zona
   if(inZone && g_totalLongs == 0 && g_totalShorts == 0)
   {
      if(InpDirection == 0 || InpDirection == 1)
         trade.Buy(InpLot, _Symbol, ask, 0, 0, "ZV Sniper Long");
      if(InpDirection == 0 || InpDirection == 2)
         trade.Sell(InpLot, _Symbol, px, 0, 0, "ZV Sniper Short");
   }

   // 12. Atualiza Dashboard grafico
   UpdateDashboard();
}
