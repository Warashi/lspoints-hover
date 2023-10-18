import {
  BaseExtension,
  Lspoints,
} from "https://deno.land/x/lspoints@v0.0.4/interface.ts";
import { Denops } from "https://deno.land/x/lspoints@v0.0.4/deps/denops.ts";
import { LSP } from "https://deno.land/x/lspoints@v0.0.4/deps/lsp.ts";
import { u } from "https://deno.land/x/lspoints@v0.0.4/deps/unknownutil.ts";
import {
  makePositionParams,
  OffsetEncoding,
} from "https://deno.land/x/denops_lsputil@v0.9.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v5.0.1/function/mod.ts";

function splitLines(s: string): string[] {
  return s.replaceAll(/\r\n?/g, "\n")
    .replaceAll("<br>", "\n")
    .split("\n")
    .filter(Boolean);
}

export class Extension extends BaseExtension {
  initialize(denops: Denops, lspoints: Lspoints) {
    lspoints.defineCommands("hover", {
      execute: async () => {
        const clients = lspoints.getClients(await fn.bufnr(denops))
          .filter((c) => c.serverCapabilities.hoverProvider !== undefined);
        if (clients.length === 0) {
          denops.cmd(`echoerr 'Hover is not supported'`);
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
          denops.cmd(`echoerr 'No information'`);
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
          `vim.lsp.util.open_floating_preview(_A[1], _A[2], { border = "single", title = "Hover" })`,
          [lines, format],
        );
      },
    });
  }
}
