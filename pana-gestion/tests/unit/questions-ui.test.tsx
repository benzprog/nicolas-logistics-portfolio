import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { QuestionsTable } from "@/features/mercadolibre/questions/components/questions-table";
import { QuestionStatusBadge } from "@/features/mercadolibre/questions/components/question-status-badge";
import { QuestionHistory } from "@/features/mercadolibre/questions/components/question-history";
import { ItemCard } from "@/features/mercadolibre/questions/components/item-card";
import type { QuestionDetail, QuestionListItem } from "@/features/mercadolibre/questions/queries";

const hace = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();

const item = {
  ml_item_id: "MLA123456789",
  title: "Lámpara LED 9W E27 luz fría",
  thumbnail_url: null,
  permalink: "https://articulo.mercadolibre.com.ar/MLA-123456789",
  price: 3500,
  currency_id: "ARS",
  available_quantity: 42,
};

function pregunta(overrides: Partial<QuestionListItem> = {}): QuestionListItem {
  return {
    id: "q1",
    account_id: "c1",
    ml_question_id: 5036111111,
    ml_item_id: "MLA123456789",
    ml_seller_id: 1,
    ml_buyer_id: 2,
    text: "¿Tienen stock en luz cálida?",
    status: "pending",
    ml_status: "UNANSWERED",
    ml_date_created: hace(3),
    answer_text: null,
    answered_at: null,
    answered_by: null,
    answer_source: null,
    last_error: null,
    raw: {},
    last_synced_at: hace(1),
    deleted_at: null,
    created_at: hace(3),
    updated_at: hace(1),
    mercadolibre_items: item,
    ...overrides,
  } as QuestionListItem;
}

describe("estado de una pregunta", () => {
  it("muestra el estado en castellano", () => {
    const { rerender } = render(<QuestionStatusBadge status="pending" />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();

    rerender(<QuestionStatusBadge status="answered" />);
    expect(screen.getByText("Respondida")).toBeInTheDocument();

    rerender(<QuestionStatusBadge status="archived" />);
    expect(screen.getByText("Archivada")).toBeInTheDocument();
  });

  it("avisa cuando el último envío falló", () => {
    // La pregunta sigue pendiente, pero que alguien ya intentó responderla y
    // no salió es información distinta: se ve como tal.
    render(<QuestionStatusBadge status="pending" hasError />);
    expect(screen.getByText("Falló el envío")).toBeInTheDocument();
  });

  it("un error viejo no contradice a una pregunta ya respondida", () => {
    render(<QuestionStatusBadge status="answered" hasError />);
    expect(screen.getByText("Respondida")).toBeInTheDocument();
  });
});

describe("listado", () => {
  it("muestra la pregunta, la publicación y la antigüedad", () => {
    render(<QuestionsTable questions={[pregunta()]} emptyTitle="vacío" />);

    expect(screen.getByText("¿Tienen stock en luz cálida?")).toBeInTheDocument();
    expect(screen.getByText("Lámpara LED 9W E27 luz fría")).toBeInTheDocument();
    expect(screen.getByText("3 h")).toBeInTheDocument();
  });

  it("cada fila lleva al detalle", () => {
    render(<QuestionsTable questions={[pregunta()]} emptyTitle="vacío" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/mercadolibre/preguntas/q1");
  });

  it("adelanta la respuesta de las ya respondidas", () => {
    render(
      <QuestionsTable
        questions={[pregunta({ status: "answered", answer_text: "Sí, hay stock." })]}
        emptyTitle="vacío"
      />,
    );
    expect(screen.getByText(/Respuesta: Sí, hay stock\./)).toBeInTheDocument();
  });

  it("explica el vacío en vez de mostrar una tabla pelada", () => {
    render(
      <QuestionsTable
        questions={[]}
        emptyTitle="No hay preguntas pendientes"
        emptyDescription="Está todo respondido."
      />,
    );

    expect(screen.getByText("No hay preguntas pendientes")).toBeInTheDocument();
    expect(screen.getByText("Está todo respondido.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("no se rompe si falta la publicación", () => {
    render(
      <QuestionsTable questions={[pregunta({ mercadolibre_items: null })]} emptyTitle="vacío" />,
    );
    expect(screen.getByText("MLA123456789")).toBeInTheDocument();
  });
});

describe("ficha de la publicación", () => {
  it("muestra precio y stock en formato argentino", () => {
    render(<ItemCard item={item} />);

    expect(screen.getByText("Lámpara LED 9W E27 luz fría")).toBeInTheDocument();
    expect(screen.getByText(/3\.500/)).toBeInTheDocument();
    expect(screen.getByText("42 en stock")).toBeInTheDocument();
  });

  it("marca cuando no hay stock", () => {
    // Quien responde tiene que verlo antes de prometer una entrega.
    render(<ItemCard item={{ ...item, available_quantity: 0 }} />);
    expect(screen.getByText("Sin stock")).toBeInTheDocument();
  });

  it("es honesta cuando no sabe el stock", () => {
    render(<ItemCard item={{ ...item, available_quantity: null }} />);
    expect(screen.getByText("Stock desconocido")).toBeInTheDocument();
  });

  it("enlaza a la publicación en Mercado Libre", () => {
    render(<ItemCard item={item} />);
    const enlace = screen.getByRole("link", { name: /ver en ml/i });
    expect(enlace).toHaveAttribute("href", item.permalink);
    expect(enlace).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});

describe("historial", () => {
  const intentos = [
    {
      id: "a2",
      question_id: "q1",
      text: "Sí, tenemos stock.",
      status: "sent" as const,
      source: "pana" as const,
      sent_by: "u1",
      sent_at: hace(1),
      ml_response: {},
      error_code: null,
      error_message: null,
      created_at: hace(1),
      profiles: { id: "u1", full_name: "Ana Benítez" },
    },
    {
      id: "a1",
      question_id: "q1",
      text: "Sí, tenemos stock.",
      status: "failed" as const,
      source: "pana" as const,
      sent_by: "u1",
      sent_at: null,
      ml_response: null,
      error_code: "ml_unavailable",
      error_message: "Mercado Libre no respondió a tiempo",
      created_at: hace(2),
      profiles: { id: "u1", full_name: "Ana Benítez" },
    },
  ] as unknown as QuestionDetail["question_answers"];

  it("muestra quién respondió y qué escribió", () => {
    render(<QuestionHistory answers={intentos} />);
    expect(screen.getAllByText("Ana Benítez")).toHaveLength(2);
  });

  it("muestra también los intentos fallidos y por qué fallaron", () => {
    // Es lo que responde la pregunta "yo la contesté, ¿por qué sigue pendiente?".
    render(<QuestionHistory answers={intentos} />);
    expect(screen.getByText("no se envió")).toBeInTheDocument();
    expect(screen.getByText("Mercado Libre no respondió a tiempo")).toBeInTheDocument();
  });

  it("distingue una respuesta que vino de la app de Mercado Libre", () => {
    render(
      <QuestionHistory
        answers={
          [
            { ...intentos[0]!, source: "external", profiles: null },
          ] as unknown as QuestionDetail["question_answers"]
        }
      />,
    );
    expect(screen.getByText("Respondida desde Mercado Libre")).toBeInTheDocument();
  });

  it("no deja el bloque vacío cuando no hubo intentos", () => {
    render(<QuestionHistory answers={[] as unknown as QuestionDetail["question_answers"]} />);
    expect(screen.getByText(/todavía no hubo intentos/i)).toBeInTheDocument();
  });
});
