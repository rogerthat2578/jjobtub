import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const DEFAULT_CHUNK_SIZE = 1024 * 1024;

@Injectable()
export class StreamingService {
  parseRange(rangeHeader: string | undefined, fileSize: number) {
    if (!rangeHeader) {
      return {
        statusCode: HttpStatus.OK,
        start: 0,
        end: fileSize - 1,
        contentLength: fileSize,
      };
    }

    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (!match) {
      this.throwInvalidRange(fileSize);
    }

    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : start + DEFAULT_CHUNK_SIZE - 1;
    const end = Math.min(requestedEnd, fileSize - 1);

    if (!Number.isInteger(start) || !Number.isInteger(end) || start >= fileSize || end < start) {
      this.throwInvalidRange(fileSize);
    }

    return {
      statusCode: HttpStatus.PARTIAL_CONTENT,
      start,
      end,
      contentLength: end - start + 1,
    };
  }

  private throwInvalidRange(fileSize: number): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        message: 'Range Not Satisfiable',
      },
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      {
        cause: `bytes */${fileSize}`,
      },
    );
  }
}
