import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * El formulario de respuesta es donde una persona invierte trabajo. Lo que se
 * prueba acá no es el estilo: es que no se pueda enviar vacío, que no se pueda
 * enviar dos veces, y que un error no le borre lo que escribió.
 */

const answerMock = vi.fn();
const refreshMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/features/mercadolibre/questions/actions", () => ({
  answerQuestion: (...args: unknown[]) => answerMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const { AnswerForm } = await import("@/features/mercadolibre/questions/components/answer-form");

beforeEach(() => {
  answerMock.mockReset().mockResolvedValue({ ok: true, data: null });
  refreshMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("formulario de respuesta", () => {
  it("no deja enviar vacío", async () => {
    render(<AnswerForm questionId="pregunta-1" />);

    expect(screen.getByRole("button", { name: /enviar respuesta/i })).toBeDisabled();
  });

  it("sigue sin dejar enviar si solo hay espacios", async () => {
    const user = userEvent.setup();
    render(<AnswerForm questionId="pregunta-1" />);

    await user.type(screen.getByLabelText(/tu respuesta/i), "    ");

    expect(screen.getByRole("button", { name: /enviar respuesta/i })).toBeDisabled();
  });

  it("envía el texto sin espacios de sobra", async () => {
    const user = userEvent.setup();
    render(<AnswerForm questionId="pregunta-1" />);

    await user.type(screen.getByLabelText(/tu respuesta/i), "  Sí, hay stock.  ");
    await user.click(screen.getByRole("button", { name: /enviar respuesta/i }));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith({
        questionId: "pregunta-1",
        text: "Sí, hay stock.",
      }),
    );
  });

  it("limpia el campo y avisa cuando sale bien", async () => {
    const user = userEvent.setup();
    render(<AnswerForm questionId="pregunta-1" />);

    const campo = screen.getByLabelText(/tu respuesta/i);
    await user.type(campo, "Sí, hay stock.");
    await user.click(screen.getByRole("button", { name: /enviar respuesta/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(campo).toHaveValue("");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("NO borra lo escrito cuando falla", async () => {
    // Es lo que más cuida el trabajo de la persona: si Mercado Libre no
    // responde, lo último que tiene que pasar es que además pierda el texto.
    answerMock.mockResolvedValue({ ok: false, error: "Mercado Libre no respondió." });

    const user = userEvent.setup();
    render(<AnswerForm questionId="pregunta-1" />);

    const campo = screen.getByLabelText(/tu respuesta/i);
    await user.type(campo, "Sí, hay stock en luz cálida.");
    await user.click(screen.getByRole("button", { name: /enviar respuesta/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(campo).toHaveValue("Sí, hay stock en luz cálida.");
  });

  it("no permite un segundo envío mientras el primero está en curso", async () => {
    let resolver: ((value: unknown) => void) | undefined;
    answerMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<AnswerForm questionId="pregunta-1" />);

    await user.type(screen.getByLabelText(/tu respuesta/i), "Sí.");
    await user.click(screen.getByRole("button", { name: /enviar respuesta/i }));

    // Mientras está enviando, el botón cambia de texto y queda deshabilitado.
    const enviando = await screen.findByRole("button", { name: /enviando/i });
    expect(enviando).toBeDisabled();

    await user.click(enviando);
    expect(answerMock).toHaveBeenCalledTimes(1);

    resolver?.({ ok: true, data: null });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("avisa cuando el texto supera el máximo", async () => {
    const user = userEvent.setup();
    render(<AnswerForm questionId="pregunta-1" />);

    await user.click(screen.getByLabelText(/tu respuesta/i));
    await user.paste("a".repeat(2001));

    expect(screen.getByText(/te pasaste del máximo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar respuesta/i })).toBeDisabled();
  });

  it("muestra cuántos caracteres van", async () => {
    const user = userEvent.setup();
    render(<AnswerForm questionId="pregunta-1" />);

    await user.type(screen.getByLabelText(/tu respuesta/i), "Hola");
    expect(screen.getByText(/4 \/ 2000 caracteres/)).toBeInTheDocument();
  });
});
