import { os } from "@orpc/server"
import type { RouterContext } from "./context"

/**
 * Base procedure builder with the shared RouterContext.
 *
 * All router procedures should be built from this base so they
 * automatically receive the injected context (client, appDs, etc.).
 */
export const base = os.$context<RouterContext>()
