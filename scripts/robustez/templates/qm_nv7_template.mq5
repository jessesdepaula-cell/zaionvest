//+------------------------------------------------------------------+
//|  ZaionVest EA — Zaion Sniper (Replicando Inputs QuantMiner)      |
//|  Grid Fibonacci Hedgeado com Painel Grafico em tela e WebRequest |
//+------------------------------------------------------------------+
#property strict
#property version   "4.00"
#include <Trade/Trade.mqh>

//--- Identidade / licenca ---
input string InpEAId      = "__EA_ID__";      // id do EA na vitrine
input string InpEmail     = "";               // e-mail do assinante (obrigatorio)
input string InpStatusUrl = "__STATUS_URL__"; // endpoint de licenca
input int    InpDirection = __DIRECTION__;    // 0=both 1=long-only 2=short-only
input ulong  InpMagic     = __MAGIC__;

//--- Parametros do Operacional (Replicados do Print QuantMiner) ---
input double InpLotBuy      = __LOT_BUY__;      // Lote para compra (ex: 0.02)
input double InpLotSell     = __LOT_SELL__;     // Lote para venda (ex: 0.01)
input int    InpGridStep    = __GRID_STEP__;    // Distancia do grid (pontos, ex: 1100)
input int    InpTpPoints    = __TP_POINTS__;    // Take profit por posicao (pontos, ex: 2775)

//--- Filtro de Fibonacci ---
input ENUM_TIMEFRAMES InpFibTimeframe = __FIB_TIMEFRAME__; // Timeframe do Fibonacci (ex: PERIOD_M30)
input int    InpSwingBars   = __SWING_BARS__;   // No de barras para buscar swing H/L (ex: 150)
input double InpFibLowPct   = __FIB_LOW_PCT__;  // Nivel Fibo inferior da zona (%) (ex: 38.2)
input double InpFibHighPct  = __FIB_HIGH_PCT__; // Nivel Fibo superior da zona (%) (ex: 50.0)

//--- Protecoes e Cluster ---
input double InpDdGuard     = __DD_GUARD_PCT__; // DD das vendas/compras para fechar (% sobre ref) (ex: 5.0)
input double InpMaxDdPct    = __MAX_DD_PCT__;   // Max DD da conta (% de stop) (ex: 30.0)
input int    InpClusterMin  = __CLUSTER_MIN__;  // Minimo de posicoes para acionar cluster (ex: 10)
input double InpClusterSobra = __CLUSTER_SOBRA__; // Sobra liquida minima (USD) para cluster (ex: 11.0)
input int    InpMaxLvl      = __MAX_POSITIONS__;// Maximo de posicoes por lado (ex: 8)

CTrade   trade;
int      hAtr=INVALID_HANDLE;
datetime g_lastLicenseCheck=0;
datetime g_lastGoodLicense=0;
bool     g_licenseOk=true;
datetime g_lastBarTime=0;
int      g_cooldown=0;

// Arrays de posicoes abertas
double   g_longs[];
double   g_shorts[];
int      g_totalLongs=0;
int      g_totalShorts=0;
double   g_last_ordered_buy_price=0;
double   g_last_ordered_sell_price=0;

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
   
   if(g_totalLongs > 0) ArraySort(g_longs);
   else g_last_ordered_buy_price = 0;
   
   if(g_totalShorts > 0) ArraySort(g_shorts);
   else g_last_ordered_sell_price = 0;
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
   double targetSymVal = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   if(targetSymVal <= 0) targetSymVal = 100000.0;
   
   if(side == 1)
   {
      for(int i=0; i<g_totalLongs; i++) p += (px - g_longs[i]) * InpLotBuy * targetSymVal;
   }
   else if(side == -1)
   {
      for(int i=0; i<g_totalShorts; i++) p += (g_shorts[i] - px) * InpLotSell * targetSymVal;
   }
   return p;
}

//+------------------------------------------------------------------+
//| Desenha as linhas de Fibonacci e a Regiao Amarela no Grafico     |
//+------------------------------------------------------------------+
void DrawFiboGraphics(double hi, double lo, double z_hi, double z_lo, int highestIdx, int lowestIdx)
{
   datetime t_start = iTime(_Symbol, InpFibTimeframe, MathMax(highestIdx, lowestIdx));
   if(t_start <= 0)
   {
      t_start = iTime(_Symbol, _Period, MathMax(highestIdx, lowestIdx));
      if(t_start <= 0)
      {
         t_start = TimeCurrent() - PeriodSeconds(_Period) * MathMax(highestIdx, lowestIdx);
      }
   }
   datetime t_end   = TimeCurrent() + PeriodSeconds(_Period) * 10;
   
   // 1. Caixa Amarela / Laranja Translucida (Zona de Fibonacci)
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
//| Desenha as linhas horizontais dos proximos niveis do Grid e TP   |
//+------------------------------------------------------------------+
void DrawGridLevels()
{
   ObjectsDeleteAll(0, "ZV_GRID_");
   
   // 1. COMPRAS (Longs)
   if(g_totalLongs > 0)
   {
      // Proxima Compra planejada
      if(g_totalLongs < InpMaxLvl)
      {
         double nextLongPr = g_longs[0] - InpGridStep * _Point;
         ObjectCreate(0, "ZV_GRID_NEXT_L", OBJ_HLINE, 0, 0, nextLongPr);
         ObjectSetInteger(0, "ZV_GRID_NEXT_L", OBJPROP_COLOR, C'244,63,94'); // Vermelho
         ObjectSetInteger(0, "ZV_GRID_NEXT_L", OBJPROP_STYLE, STYLE_DASH);
         ObjectSetInteger(0, "ZV_GRID_NEXT_L", OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, "ZV_GRID_NEXT_L", OBJPROP_HIDDEN, true);
      }
      
      // TP Coletivo das Compras (pontos fixos)
      double sumLongs = 0;
      for(int i=0; i<g_totalLongs; i++) sumLongs += g_longs[i];
      double tpPrice = (sumLongs / g_totalLongs) + InpTpPoints * _Point;
      
      ObjectCreate(0, "ZV_GRID_TP_L", OBJ_HLINE, 0, 0, tpPrice);
      ObjectSetInteger(0, "ZV_GRID_TP_L", OBJPROP_COLOR, C'16,185,129'); // Verde
      ObjectSetInteger(0, "ZV_GRID_TP_L", OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, "ZV_GRID_TP_L", OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, "ZV_GRID_TP_L", OBJPROP_HIDDEN, true);
   }
   
   // 2. VENDAS (Shorts)
   if(g_totalShorts > 0)
   {
      // Proxima Venda planejada
      if(g_totalShorts < InpMaxLvl)
      {
         double nextShortPr = g_shorts[g_totalShorts-1] + InpGridStep * _Point;
         ObjectCreate(0, "ZV_GRID_NEXT_S", OBJ_HLINE, 0, 0, nextShortPr);
         ObjectSetInteger(0, "ZV_GRID_NEXT_S", OBJPROP_COLOR, C'37,99,235'); // Azul
         ObjectSetInteger(0, "ZV_GRID_NEXT_S", OBJPROP_STYLE, STYLE_DASH);
         ObjectSetInteger(0, "ZV_GRID_NEXT_S", OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, "ZV_GRID_NEXT_S", OBJPROP_HIDDEN, true);
      }
      
      // TP Coletivo das Vendas (pontos fixos)
      double sumShorts = 0;
      for(int i=0; i<g_totalShorts; i++) sumShorts += g_shorts[i];
      double tpPriceS = (sumShorts / g_totalShorts) - InpTpPoints * _Point;
      
      ObjectCreate(0, "ZV_GRID_TP_S", OBJ_HLINE, 0, 0, tpPriceS);
      ObjectSetInteger(0, "ZV_GRID_TP_S", OBJPROP_COLOR, C'16,185,129'); // Verde
      ObjectSetInteger(0, "ZV_GRID_TP_S", OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, "ZV_GRID_TP_S", OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, "ZV_GRID_TP_S", OBJPROP_HIDDEN, true);
   }
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| Inicializacao                                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(InpMagic);
   g_lastGoodLicense = TimeCurrent();
   
   if(InpEmail=="")
      Print("ZaionVest: informe seu e-mail de assinante no input InpEmail.");
      
   UpdatePositions();
   UpdateDashboard();
   
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   ObjectsDeleteAll(0, "ZV_");
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

   // 4. Checagem de Drawdown Maximo da Conta
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq = AccountInfoDouble(ACCOUNT_EQUITY);
   if(bal > 0 && (bal - eq) / bal * 100.0 >= InpMaxDdPct)
   {
      CloseBasket(0);
      g_cooldown = 30; // 30 ticks de pausa de seguranca
      UpdateDashboard();
      return;
   }

   // 5. DD-Guard por lado (% sobre saldo)
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

   // 6. Cluster-Netting Coletivo (lucro em USD real fixo, nao ATR)
   int tot = g_totalLongs + g_totalShorts;
   double net = lf + sf;
   if(tot >= InpClusterMin && net >= InpClusterSobra)
   {
      CloseBasket(0);
      g_totalLongs = 0;
      g_totalShorts = 0;
   }

   // 7. TP por Lado (Netting por pontos fixos)
   // Compras (Longs) fecha no TP calculado em pontos
   if(g_totalLongs > 0)
   {
      double sumLongs = 0;
      for(int i=0; i<g_totalLongs; i++) sumLongs += g_longs[i];
      double tpPrice = (sumLongs / g_totalLongs) + InpTpPoints * _Point;
      if(px >= tpPrice)
      {
         CloseBasket(1);
         g_totalLongs = 0;
      }
   }
   // Vendas (Shorts) fecha no TP calculado em pontos
   if(g_totalShorts > 0)
   {
      double sumShorts = 0;
      for(int i=0; i<g_totalShorts; i++) sumShorts += g_shorts[i];
      double tpPriceS = (sumShorts / g_totalShorts) - InpTpPoints * _Point;
      if(px <= tpPriceS)
      {
         CloseBasket(-1);
         g_totalShorts = 0;
      }
   }

   // 8. Checagem de Nova Barra no Timeframe do Fibonacci
   datetime t = iTime(_Symbol, InpFibTimeframe, 0);
   bool newBar = (t != g_lastBarTime);
   if(newBar) g_lastBarTime = t;

   // 9. Zona de Fibonacci (Calculo Nativo MQL5 robusto por arrays)
   double hiArr[];
   double loArr[];
   ArraySetAsSeries(hiArr, true);
   ArraySetAsSeries(loArr, true);
   
   double hi = 0.0;
   double lo = 999999.0;
   int highestIdx = 1;
   int lowestIdx = 1;
   
   int copiedHigh = CopyHigh(_Symbol, InpFibTimeframe, 1, InpSwingBars, hiArr);
   int copiedLow  = CopyLow(_Symbol, InpFibTimeframe, 1, InpSwingBars, loArr);
   
   if(copiedHigh > 0 && copiedLow > 0)
   {
      for(int i=0; i<InpSwingBars; i++)
      {
         if(i < copiedHigh && hiArr[i] > hi) { hi = hiArr[i]; highestIdx = i + 1; }
         if(i < copiedLow  && loArr[i] < lo) { lo = loArr[i]; lowestIdx = i + 1; }
      }
   }
    else
    {
       // Fallback para as de cache se der erro na copia inicial
       highestIdx = iHighest(_Symbol, InpFibTimeframe, MODE_HIGH, InpSwingBars, 1);
       lowestIdx  = iLowest(_Symbol, InpFibTimeframe, MODE_LOW, InpSwingBars, 1);
       hi = iHigh(_Symbol, InpFibTimeframe, highestIdx);
       lo = iLow(_Symbol, InpFibTimeframe, lowestIdx);
    }
    
    // Fallback absoluto: se o swing do InpFibTimeframe falhar (ex: dados vazios), usa o timeframe do grafico atual
    if(hi <= 0 || lo >= 999999.0 || hi <= lo)
    {
       int copiedHighAlt = CopyHigh(_Symbol, _Period, 1, InpSwingBars, hiArr);
       int copiedLowAlt  = CopyLow(_Symbol, _Period, 1, InpSwingBars, loArr);
       if(copiedHighAlt > 0 && copiedLowAlt > 0)
       {
          hi = 0.0; lo = 999999.0;
          for(int i=0; i<InpSwingBars; i++)
          {
             if(hiArr[i] > hi) { hi = hiArr[i]; highestIdx = i + 1; }
             if(loArr[i] < lo) { lo = loArr[i]; lowestIdx = i + 1; }
          }
       }
       else
       {
          highestIdx = iHighest(_Symbol, _Period, MODE_HIGH, InpSwingBars, 1);
          lowestIdx  = iLowest(_Symbol, _Period, MODE_LOW, InpSwingBars, 1);
          hi = iHigh(_Symbol, _Period, highestIdx);
          lo = iLow(_Symbol, _Period, lowestIdx);
       }
    }
   
   double rng = hi - lo;
   double z_hi = hi - (InpFibLowPct / 100.0) * rng;
   double z_lo = hi - (InpFibHighPct / 100.0) * rng;
   bool inZone = (px >= z_lo && px <= z_hi);
   
   DrawFiboGraphics(hi, lo, z_hi, z_lo, highestIdx, lowestIdx);

   // 10. Executa Grade / Grid de Niveis contra a ultima entrada (pontos fixos)
   if(g_totalLongs > 0 && g_totalLongs < InpMaxLvl)
   {
      double lowestLongPr = g_longs[0];
      double nextLongPr = lowestLongPr - InpGridStep * _Point;
      if(ask <= nextLongPr && (g_last_ordered_buy_price == 0 || ask < g_last_ordered_buy_price - InpGridStep * _Point * 0.8))
      {
         g_last_ordered_buy_price = ask;
         trade.Buy(InpLotBuy, _Symbol, ask, 0, 0, "ZV Sniper Long");
      }
   }
   if(g_totalShorts > 0 && g_totalShorts < InpMaxLvl)
   {
      double highestShortPr = g_shorts[g_totalShorts-1];
      double nextShortPr = highestShortPr + InpGridStep * _Point;
      if(px >= nextShortPr && (g_last_ordered_sell_price == 0 || px > g_last_ordered_sell_price + InpGridStep * _Point * 0.8))
      {
         g_last_ordered_sell_price = px;
         trade.Sell(InpLotSell, _Symbol, px, 0, 0, "ZV Sniper Short");
      }
   }

   // 11. Abertura do Hedge Principal ao entrar na zona
   if(inZone && g_totalLongs == 0 && g_totalShorts == 0)
   {
      if(InpDirection == 0 || InpDirection == 1)
      {
         g_last_ordered_buy_price = ask;
         trade.Buy(InpLotBuy, _Symbol, ask, 0, 0, "ZV Sniper Long");
      }
      if(InpDirection == 0 || InpDirection == 2)
      {
         g_last_ordered_sell_price = px;
         trade.Sell(InpLotSell, _Symbol, px, 0, 0, "ZV Sniper Short");
      }
   }

   // 12. Desenha linhas de Grid e TP
   DrawGridLevels();

   // 13. Atualiza Dashboard grafico
   UpdateDashboard();
}
