const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const SPREADSHEET_ID = "1KxLJ-Dms-hRFMYF9vCWzA3M-P_CPffA1as-5Hvbm8N4";
export const STOCK_SHEET = "Página1";
export const HISTORY_SHEET = "Movimentações";

function headers() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Conexão com o Google Sheets não configurada.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

export async function sheetsRequest(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<any> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init?.method ?? "GET",
    headers: headers(),
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Google Sheets request failed [${res.status}]: ${text}`);
    throw new Error(`Falha ao acessar a planilha [${res.status}]: ${text}`);
  }
  return res.json();
}

export async function getValues(range: string): Promise<string[][]> {
  const data = await sheetsRequest(
    `/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
  );
  return (data.values ?? []) as string[][];
}

export async function updateValues(range: string, values: (string | number)[][]) {
  return sheetsRequest(
    `/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: { values } },
  );
}

export async function appendValues(range: string, values: (string | number)[][]) {
  return sheetsRequest(
    `/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values } },
  );
}

export async function ensureHistorySheet() {
  const meta = await sheetsRequest(`/spreadsheets/${SPREADSHEET_ID}`);
  const exists = (meta.sheets ?? []).some(
    (s: any) => s?.properties?.title === HISTORY_SHEET,
  );
  if (exists) return;
  await sheetsRequest(`/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: "POST",
    body: { requests: [{ addSheet: { properties: { title: HISTORY_SHEET } } }] },
  });
  await updateValues(`${HISTORY_SHEET}!A1:F1`, [
    ["DATA", "MODELO", "TIPO", "QUANTIDADE", "SALDO FINAL", "OBSERVAÇÃO"],
  ]);
}

/** Extrai a quantidade numérica de textos como "3(1R Girmax)" ou "6/1R(". */
export function parseQuantity(raw: string | undefined): number {
  if (!raw) return 0;
  const match = String(raw).trim().match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

/** Substitui apenas o número inicial, preservando anotações do usuário. */
export function withQuantity(raw: string | undefined, quantity: number): string {
  const value = String(raw ?? "").trim();
  if (!value) return String(quantity);
  if (/-?\d+/.test(value)) return value.replace(/-?\d+/, String(quantity));
  return `${quantity} ${value}`;
}
