/* eslint-disable @next/next/no-img-element -- ImageResponse requires embedded img elements. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export async function makeBrandIcon(
  size: number,
  maskable = false,
): Promise<ImageResponse> {
  const logo = await readFile(join(process.cwd(), "public", "logo.png.jpeg"));
  const image = `data:image/jpeg;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B0F19",
        }}
      >
        <img
          src={image}
          alt=""
          style={{
            width: maskable ? "60%" : "84%",
            height: maskable ? "60%" : "84%",
            objectFit: "contain",
          }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
