import type { TimeBand, TurnType } from "../domain/hours";
import type { PageContent } from "../domain/page";
import type { ClosureEntry, Room, Settings } from "../domain/setup";

/** What GET /sauna/config answers. */
export type Config = {
  settings: Settings | null; rooms: Room[]; types: TurnType[]; bands: TimeBand[]; closures: ClosureEntry[]; page: PageContent;
  /** Whether the Mercado Pago application is set up on the server, and the account connected to this site, if any. Never its tokens. */
  mercadopago: { configured: boolean; account: { userId: string; nickname: string; connectedAt: string; liveMode: boolean } | null };
};

/** Monday first, as the week is read in Argentina. */
export const weekOrder = [1, 2, 3, 4, 5, 6, 0];
