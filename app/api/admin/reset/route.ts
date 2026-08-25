/**
 * Completa il reset: verifica il token monouso e salva la nuova password
 * (cifrata) nel database. Il token viene annullato da setAdminPassword().
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isResetTokenValid,
  setAdminPassword,
  MIN_PASSWORD_LENGTH
} from '../../../../lib/adminAuth';

export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().min(1),
  password: z.string()
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: 'Dati non validi.' }, { status: 400 });
  }

  if (parsed.password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { message: `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.` },
      { status: 400 }
    );
  }

  const valid = await isResetTokenValid(parsed.token);
  if (!valid) {
    return NextResponse.json(
      { message: 'Link non valido o scaduto. Richiedine uno nuovo dalla pagina di login.' },
      { status: 400 }
    );
  }

  await setAdminPassword(parsed.password);
  return NextResponse.json({ success: true });
}
