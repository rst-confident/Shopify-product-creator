import { Session } from '@shopify/shopify-api';
import { query } from '../db';

export class PostgreSQLSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    try {
      await query(
        `INSERT INTO sessions (id, shop, state, is_online, scope, expires, access_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           shop = $2, state = $3, is_online = $4, scope = $5, expires = $6, access_token = $7`,
        [
          session.id,
          session.shop,
          session.state,
          session.isOnline,
          session.scope,
          session.expires,
          session.accessToken,
        ]
      );
      return true;
    } catch (error) {
      console.error('Error storing session:', error);
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const result = await query('SELECT * FROM sessions WHERE id = $1', [id]);
      if (result.rows.length === 0) return undefined;

      const row = result.rows[0];
      const session = new Session({
        id: row.id,
        shop: row.shop,
        state: row.state,
        isOnline: row.is_online,
      });

      if (row.scope) session.scope = row.scope;
      if (row.expires) session.expires = row.expires;
      if (row.access_token) session.accessToken = row.access_token;

      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await query('DELETE FROM sessions WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      await query('DELETE FROM sessions WHERE id = ANY($1)', [ids]);
      return true;
    } catch (error) {
      console.error('Error deleting sessions:', error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const result = await query('SELECT * FROM sessions WHERE shop = $1', [shop]);
      return result.rows.map((row) => {
        const session = new Session({
          id: row.id,
          shop: row.shop,
          state: row.state,
          isOnline: row.is_online,
        });
        if (row.scope) session.scope = row.scope;
        if (row.expires) session.expires = row.expires;
        if (row.access_token) session.accessToken = row.access_token;
        return session;
      });
    } catch (error) {
      console.error('Error finding sessions by shop:', error);
      return [];
    }
  }
}
