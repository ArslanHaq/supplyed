import { userFacingError } from "@/lib/user-facing-error";

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
      requestId?: string;
      status?: number;
      retryAfter?: number;
    };

export function actionOk<Data>(data: Data, message?: string): ActionResult<Data> {
  return { ok: true, data, message };
}

export function actionError<Field extends string = string>(
  message: string,
  options: { code?: string; fieldErrors?: ActionFieldErrors<Field>; requestId?: string; status?: number; retryAfter?: number } = {},
): Extract<ActionResult<never, Field>, { ok: false }> {
  message = userFacingError(message, options);
  const catalogueFields = options.code === "INVALID_OTHER_SKILLS" ? { otherSkills: message } : options.code === "INVALID_OTHER_SUBJECTS" ? { otherSubjects: message } : options.code === "SKILL_SUBJECT_MISMATCH"
    ? { skills: message, requiredSkills: message }
    : options.code === "INVALID_TEACHING_SELECTION" || options.code === "CONFLICTING_JOB_SUBJECTS"
      ? { subjects: message, staffingNeeds: message, skills: message, requiredSkills: message } : undefined;
  const fieldErrors = Object.fromEntries(Object.entries({ ...catalogueFields, ...options.fieldErrors }).map(([field, value]) => [field, typeof value === "string" ? userFacingError(value) : value]));
  return { ok: false, message, ...options, fieldErrors: fieldErrors as ActionFieldErrors<Field> };
}

export function unwrapActionResult<Data>(result: ActionResult<Data>): Data {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}
