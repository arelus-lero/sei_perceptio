import { z } from 'zod';

export const loginPasswordSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z
    .string()
    .min(8, 'A senha deve ter no mínimo 8 caracteres')
    .max(128, 'A senha deve ter no máximo 128 caracteres'),
});

export const loginMagicLinkSchema = z.object({
  email: z.email('Informe um e-mail válido'),
});

export type LoginPasswordInput = z.infer<typeof loginPasswordSchema>;
export type LoginMagicLinkInput = z.infer<typeof loginMagicLinkSchema>;
