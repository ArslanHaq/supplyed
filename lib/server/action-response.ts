export type ActionFieldErrors<Field extends string = string> = Partial<Record<Field, string>>;

export type ActionResult<Data = void, Field extends string = string> =
  | {
      ok: true;
      data: Data;
      message?: string;
    }
  | {
      ok: false;
      code?: string;
      fieldErrors?: ActionFieldErrors<Field>;
      message: string;
    };

export function actionOk<Data>(data: Data, message?: string): ActionResult<Data> {
  return { ok: true, data, message };
}

export function actionError<Field extends string = string>(
  message: string,
  options: { code?: string; fieldErrors?: ActionFieldErrors<Field> } = {},
): ActionResult<never, Field> {
  return { ok: false, message, ...options };
}

export function unwrapActionResult<Data>(result: ActionResult<Data>): Data {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}
