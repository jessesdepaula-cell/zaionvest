export type AsaasCustomerInput = {
  name: string;
  email: string;
};

export type AsaasSubscriptionInput = {
  customerId: string;
  value: number;
  cycle: "MONTHLY";
  nextDueDate: string; // YYYY-MM-DD
  successUrl: string;
  cancelUrl: string;
};

const getAsaasBaseUrl = () => {
  const env = process.env.ASAAS_ENV ?? "sandbox";
  return env === "production"
    ? "https://www.asaas.com/api/v3"
    : "https://sandbox.asaas.com/api/v3";
};

const getAsaasHeaders = () => {
  return {
    "Content-Type": "application/json",
    access_token: process.env.ASAAS_API_KEY ?? "",
  };
};

export async function createAsaasCustomer(input: AsaasCustomerInput): Promise<string> {
  const isMock = process.env.ASAAS_MOCK === "true" || !process.env.ASAAS_API_KEY;

  if (isMock) {
    console.log("[Asaas Mock] Criando cliente:", input);
    return `cus_mock_${Math.random().toString(36).substring(2, 9)}`;
  }

  const baseUrl = getAsaasBaseUrl();
  const res = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: getAsaasHeaders(),
    body: JSON.stringify({
      name: input.name,
      email: input.email,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao criar cliente Asaas: ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  return data.id;
}

export async function createAsaasSubscriptionCheckout(
  input: AsaasSubscriptionInput
): Promise<string> {
  const isMock = process.env.ASAAS_MOCK === "true" || !process.env.ASAAS_API_KEY;

  if (isMock) {
    console.log("[Asaas Mock] Criando checkout recorrente:", input);
    // Retorna uma URL interna de sucesso mockada para ativar o usuário de forma simulada
    return `${input.successUrl}&mock_active=true`;
  }

  const baseUrl = getAsaasBaseUrl();

  // O Asaas Checkout API permite criar um link de checkout associado a um plano recorrente (RECURRENT)
  const payload = {
    billingTypes: ["CREDIT_CARD"],
    chargeTypes: "RECURRENT",
    customer: input.customerId,
    subscription: {
      cycle: input.cycle,
      value: input.value,
      nextDueDate: input.nextDueDate,
      description: "Assinatura ZaionVest",
    },
    callback: {
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      autoRedirect: true,
    },
  };

  const res = await fetch(`${baseUrl}/checkouts`, {
    method: "POST",
    headers: getAsaasHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Falha ao criar checkout de assinatura Asaas: ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  return data.checkoutUrl;
}
