import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { log } from '@logtail/next';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import User from '@/database/models/User';
import { INCORRECT_PASSWORD, NOT_FOUND_USER } from '@/src/helpers/constants/errors';
import redis from '@/src/redis';
import { sessionOptions } from '@/lib/session';

export async function POST(req: NextRequest) {
  const res = NextResponse;
  const session: any = await getIronSession(cookies(), sessionOptions);

  try {
    const { email, password } = await req.json();
    const user = await User.findOne({ email });

    if (!user) return res.json({ errors: [NOT_FOUND_USER] }, { status: 404 });

    const match = await bcrypt.compare(password, user?.password);

    if (!match) return res.json({ errors: [INCORRECT_PASSWORD] }, { status: 401 });

    const randomSessionId = uuidv4();
    session.user = randomSessionId;

    await session.save();
    await redis.set(randomSessionId, JSON.stringify({ id: user?.id, roles: user?.roles, email }));

    log.info('Logged successfully', { email });
    return res.json({ message: 'Ok' }, { status: 200 });
  } catch (error: any) {
    const mapedErrors = Object.keys(error.errors).map((key) => ({
      path: key,
      message: error.errors[key].message,
    }));
    log.error('Error - api login', { error });

    return res.json({ errors: mapedErrors }, { status: 422 });
  }
}
