import { type NextRequest, NextResponse } from "next/server";

import { encryptionService, auth } from "~/lib/utils.server";
import { GetFile } from "~/actions/files";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      encryptedId: string;
    }>;
  },
) {
  const { encryptedId } = await params;

  try {
    const file = await GetFile(encryptedId);
    if (!file.success) {
      throw new Error(`[404] ${file.message}`, {
        cause: file.error,
      });
    }

    const decryptedId = await encryptionService.decrypt(encryptedId);
    
    // Get the fresh read-only access token
    const token = await auth.getAccessToken();

    // Construct the direct Google API streaming URL
    // This allows VLC to bypass Vercel entirely and stream directly from Google's servers
    const directStreamUrl = `https://www.googleapis.com/drive/v3/files/${decryptedId}?alt=media&access_token=${token}`;

    const m3uContent = `#EXTM3U\n#EXTINF:-1,${file.data.name}\n${directStreamUrl}`;

    return new NextResponse(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `attachment; filename="${file.data.name}.m3u"`,
      },
    });
  } catch (error) {
    const e = error as Error;
    const message = e.message.replace(/\[.*\]/, "").trim();
    const status = /\[.*\]/.exec(e.message)?.[0].replace(/\[|\]/g, "").trim() ?? 500;

    return NextResponse.json(
      {
        scope: "api/external-stream",
        message,
        cause: e.cause ?? "Unknown",
      },
      {
        status: Number(status),
      },
    );
  }
}
