import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordService {
  async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }

  async verifyPassword(password: string, passwordHash: string) {
    const [algorithm, salt, expectedHash] = passwordHash.split(':');
    if (algorithm !== 'scrypt' || !salt || !expectedHash) {
      return false;
    }

    const actual = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(expectedHash, 'hex');
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  }
}

