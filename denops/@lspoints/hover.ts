import {
  BaseExtension,
  Lspoints,
} from "https://deno.land/x/lspoints@v0.0.7/interface.ts";
import { Denops } from "https://deno.land/x/lspoints@v0.0.7/deps/denops.ts";
import { LSP } from "https://deno.land/x/lspoints@v0.0.7/deps/lsp.ts";
import { u } from "https://deno.land/x/lspoints@v0.0.7/deps/unknownutil.ts";
import {
  makePositionParams,
  OffsetEncoding,
} from "https://deno.land/x/denops_lsputil@v0.9.5/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.5.0/function/mod.ts";
import { echo } from "https://deno.land/x/denops_std@v6.5.0/helper/mod.ts";

function splitLines(s: string): string[] {
  return s.replaceAll(/\r\n?/g, "\n")
    .replaceAll("<br>", "\n")
    .split("\n")
    .filter(Boolean);
}

const isOption = u.isOptionalOf(u.isObjectOf({
  title: u.isOptionalOf(u.isString),
  border: u.isOptionalOf(u.isString),
  zindex: u.isOptionalOf(u.isNumber),
  wrap: u.isOptionalOf(u.isBoolean),
  max_width: u.isOptionalOf(u.isNumber),
  max_height: u.isOptionalOf(u.isNumber),
  offset_x: u.isOptionalOf(u.isNumber),
  offset_y: u.isOptionalOf(u.isNumber),
}));

export class Extension extends BaseExtension {
  initialize(denops: Denops, lspoints: Lspoints) {
    lspoints.defineCommands("hover", {
      execute: async (opts?: unknown) => {
        if (!isOption(opts)) {
          echo(denops, `Invalid option: ${JSON.stringify(opts)}`);
          return;
        }

        const clients = lspoints.getClients(await fn.bufnr(denops))
          .filter((c) => c.serverCapabilities.hoverProvider !== undefined);
        if (clients.length === 0) {
          echo(denops, "Hover is not supported");
          return;
        }
        const client = clients[0];

        const offsetEncoding = client.serverCapabilities
          .positionEncoding as OffsetEncoding;
        const params = await makePositionParams(denops, 0, 0, offsetEncoding);
        const result = await lspoints.request(
          client.name,
          "textDocument/hover",
          params,
        ) as LSP.Hover | null;
        if (result === null) {
          echo(denops, "No information");
          return;
        }
        const contents = result.contents;

        const lines: string[] = [];
        let format = "markdown";

        const parseMarkedString = (ms: LSP.MarkedString) => {
          if (u.isString(ms)) {
            lines.push(...splitLines(ms));
          } else {
            lines.push("```" + ms.language, ...splitLines(ms.value), "```");
          }
        };

        if (u.isString(contents) || "language" in contents) {
          // MarkedString
          parseMarkedString(contents);
        } else if (u.isArray(contents)) {
          // MarkedString[]
          contents.forEach(parseMarkedString);
        } else if ("kind" in contents) {
          // MarkupContent
          if (contents.kind === "plaintext") {
            format = "plaintext";
          }
          lines.push(...splitLines(contents.value));
        }

        await denops.call(
          "luaeval",
          `vim.lsp.util.open_floating_preview(_A[1], _A[2], _A[3])`,
          [lines, format, opts ?? {}],
        );
      },
    });
  }
}
