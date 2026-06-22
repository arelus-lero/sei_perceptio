import { NextResponse } from 'next/server';

import {
  DuplicateChecksumError,
  SimilarContentError,
} from '@/lib/dedup/dedup-errors';

export function uploadDedupErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof DuplicateChecksumError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        duplicates: error.duplicates,
        requires_confirmation: true,
        blocking: true,
      },
      { status: error.httpStatus },
    );
  }

  if (error instanceof SimilarContentError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        matches: error.matches,
        requires_confirmation: true,
        blocking: error.blocking,
      },
      { status: error.httpStatus },
    );
  }

  return null;
}
