import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { fetchLiveFxRates } from "../utils/fxRates";

/** GET /api/accounts/fx-rates — live USD→PKR & CAD→PKR (Google Finance first). */
export async function getLiveFxRates(_req: AuthRequest, res: Response) {
  try {
    const rates = await fetchLiveFxRates();
    return res.json({ success: true, ...rates });
  } catch (err) {
    console.log(err);
    return res.status(502).json({
      success: false,
      message: "Live FX rates fetch nahi ho saki. Thori der baad try karein.",
    });
  }
}
