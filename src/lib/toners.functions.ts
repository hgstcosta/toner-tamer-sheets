import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Toner = {
  row: number;
  modelo: string;
  statusAtual: string;
  quantidade: number;
  total: number;
  cartucho: string;
  solicitado: string;
  minimo: number;
};

export type Movimento = {
  data: string;
  modelo: string;
  tipo: string;
  quantidade: number;
  saldo: number;
  observacao: string;
};

const DEFAULT_MIN = 2;

export const listToners = createServerFn({ method: "GET" }).handler(async () => {
  const { getValues, STOCK_SHEET, parseQuantity } = await import("./sheets.server");
  const rows = await getValues(`${STOCK_SHEET}!A1:F200`);
  const body = rows.slice(1);
  const toners: Toner[] = body
    .map((r, i) => ({
      row: i + 2,
      modelo: (r[0] ?? "").trim(),
      statusAtual: r[1] ?? "",
      quantidade: parseQuantity(r[1]),
      total: parseQuantity(r[2]),
      cartucho: r[3] ?? "",
      solicitado: r[4] ?? "",
      minimo: r[5] ? parseQuantity(r[5]) : DEFAULT_MIN,
    }))
    .filter((t) => t.modelo.length > 0);
  return { toners };
});

export const listHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { sheetsRequest, SPREADSHEET_ID, HISTORY_SHEET, parseQuantity } = await import(
    "./sheets.server"
  );
  const meta = await sheetsRequest(`/spreadsheets/${SPREADSHEET_ID}`);
  const exists = (meta.sheets ?? []).some(
    (s: any) => s?.properties?.title === HISTORY_SHEET,
  );
  if (!exists) return { movimentos: [] as Movimento[] };
  const { getValues } = await import("./sheets.server");
  const rows = await getValues(`${HISTORY_SHEET}!A2:F500`);
  const movimentos: Movimento[] = rows
    .filter((r) => (r[0] ?? "").trim().length > 0)
    .map((r) => ({
      data: r[0] ?? "",
      modelo: r[1] ?? "",
      tipo: r[2] ?? "",
      quantidade: parseQuantity(r[3]),
      saldo: parseQuantity(r[4]),
      observacao: r[5] ?? "",
    }))
    .reverse();
  return { movimentos };
});

export const registrarMovimento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        row: z.number().int().min(2),
        tipo: z.enum(["ENTRADA", "SAIDA"]),
        quantidade: z.number().int().min(1).max(1000),
        observacao: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const {
      getValues,
      updateValues,
      appendValues,
      ensureHistorySheet,
      parseQuantity,
      withQuantity,
      STOCK_SHEET,
      HISTORY_SHEET,
    } = await import("./sheets.server");

    const rows = await getValues(`${STOCK_SHEET}!A${data.row}:F${data.row}`);
    const row = rows[0];
    if (!row || !(row[0] ?? "").trim()) throw new Error("Toner não encontrado na planilha.");

    const atual = parseQuantity(row[1]);
    const delta = data.tipo === "ENTRADA" ? data.quantidade : -data.quantidade;
    const novo = Math.max(0, atual + delta);

    await updateValues(`${STOCK_SHEET}!B${data.row}`, [[withQuantity(row[1], novo)]]);

    await ensureHistorySheet();
    await appendValues(`${HISTORY_SHEET}!A:F`, [
      [
        new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        row[0] ?? "",
        data.tipo === "ENTRADA" ? "Entrada" : "Saída",
        data.quantidade,
        novo,
        data.observacao ?? "",
      ],
    ]);

    return { quantidade: novo };
  });

export const cadastrarToner = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        modelo: z.string().trim().min(2).max(120),
        cartucho: z.string().trim().max(120).optional(),
        quantidade: z.number().int().min(0).max(1000),
        minimo: z.number().int().min(0).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { appendValues, STOCK_SHEET } = await import("./sheets.server");
    await appendValues(`${STOCK_SHEET}!A:F`, [
      [
        data.modelo,
        data.quantidade,
        data.quantidade,
        data.cartucho ?? "",
        "NÃO PRECISA",
        data.minimo,
      ],
    ]);
    return { ok: true };
  });

export const definirMinimo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ row: z.number().int().min(2), minimo: z.number().int().min(0).max(1000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { updateValues, STOCK_SHEET } = await import("./sheets.server");
    await updateValues(`${STOCK_SHEET}!F1`, [["MÍNIMO"]]);
    await updateValues(`${STOCK_SHEET}!F${data.row}`, [[data.minimo]]);
    return { ok: true };
  });
