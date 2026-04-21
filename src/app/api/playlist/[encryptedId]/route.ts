import { type NextRequest, NextResponse } from "next/server";

import { encryptionService } from "~/lib/utils.server";
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
    if (!file.data?.encryptedWebContentLink) {
      throw new Error("[500] No download link found", {
        cause: "No download link found",
      });
    }

    const decryptedLink = await encryptionService.decrypt(file.data.encryptedWebContentLink);

    // Create M3U playlist content
    const m3uContent = `#EXTM3U\n#EXTINF:-1,${file.data.name}\n${decryptedLink}`;

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
        scope: "api/playlist",
        message,
        cause: e.cause ?? "Unknown",
      },
      {
        status: Number(status),
      },
    );
  }
}
