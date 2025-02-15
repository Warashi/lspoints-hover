import { BaseExtension, Client, Lspoints } from "jsr:@kuuote/lspoints@0.1.1";
import { Denops } from "jsr:@denops/std@7.4.0";
import { as, ensure, is } from "jsr:@core/unknownutil@4.3.0";
import {
  makePositionParams,
  OffsetEncoding,
} from "jsr:@uga-rosa/denops-lsputil@0.10.1";
import * as fn from "jsr:@denops/std@7.4.0/function";
import * as buffer from "jsr:@denops/std@7.4.0/buffer";
import { echo } from "jsr:@denops/std@7.4.0/helper";
import * as popup from "jsr:@denops/std@7.4.0/popup";
import * as autocmd from "jsr:@denops/std@7.4.0/autocmd";
import * as lambda from "jsr:@denops/std@7.4.0/lambda";
import { expr } from "jsr:@denops/std@7.4.0/eval";
import * as option from "jsr:@denops/std@7.4.0/option";

function splitLines(s: string): string[] {
  return s.replaceAll(/\r\n?/g, "\n")
    .replaceAll("<br>", "\n")
    .split("\n")
    .filter(Boolean);
}

const isBorder = is.UnionOf([
  is.LiteralOf("single"),
  is.LiteralOf("double"),
  is.LiteralOf("rounded"),
  is.TupleOf([
    is.String,
    is.String,
    is.String,
    is.String,
    is.String,
    is.String,
    is.String,
    is.String,
  ]),
]);

const isOption = as.Optional(is.ObjectOf({
  title: as.Optional(is.String),
  border: as.Optional(isBorder),
  zindex: as.Optional(is.Number),
  wrap: as.Optional(is.Boolean),
  max_width: as.Optional(is.Number),
  max_height: as.Optional(is.Number),
  offset_x: as.Optional(is.Number),
  offset_y: as.Optional(is.Number),
}));

const isMarkedString = is.UnionOf([
  is.String,
  is.ObjectOf({
    language: is.String,
    value: is.String,
  }),
]);

const isMarkupContent = is.ObjectOf({
  kind: is.String,
  value: is.String,
});

const isPosition = is.ObjectOf({
  line: is.Number,
  character: is.Number,
});

const isRange = is.ObjectOf({
  start: isPosition,
  end: isPosition,
});

const isHover = is.ObjectOf({
  contents: is.UnionOf([
    isMarkedString,
    is.ArrayOf(isMarkedString),
    isMarkupContent,
  ]),
  range: as.Optional(isRange),
});

const requestHover = async (
  denops: Denops,
  lspoints: Lspoints,
  client: Client,
) => {
  const offsetEncoding = client.serverCapabilities
    .positionEncoding as OffsetEncoding;
  const params = await makePositionParams(denops, 0, 0, offsetEncoding);
  const result = await lspoints.request(
    client.name,
    "textDocument/hover",
    params,
  );
  if (result == null) {
    return null;
  }
  return ensure(result, isHover);
};

const createPopup = async (
  denops: Denops,
  content: string,
  opts: popup.OpenOptions,
) => {
  const bufnr = await fn.bufadd(denops, "");
  await fn.bufload(denops, bufnr);

  await buffer.replace(denops, bufnr, content.split("\n"));

  await option.filetype.setBuffer(denops, bufnr, "markdown");

  // Open a popup window showing the buffer
  const popupWindow = await popup.open(denops, { ...opts, bufnr });

  await option.number.setWindow(denops, popupWindow.winid, false);

  return popupWindow;
};

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

        const hovers = (await Promise.all(clients.map(async (client) =>
          await requestHover(denops, lspoints, client)
        ))).filter((x) =>
          x != null
        );

        if (hovers.length === 0) {
          echo(denops, "No hover information");
          return;
        }

        const content = hovers.map((hover) => {
          if (is.Array(hover.contents)) {
            return hover.contents.map((c) => {
              if (is.String(c)) {
                return splitLines(c);
              } else {
                return splitLines(c.value);
              }
            }).flat();
          }
          if (isMarkedString(hover.contents)) {
            if (is.String(hover.contents)) {
              return splitLines(hover.contents);
            }
            return splitLines(hover.contents.value);
          }
          if (isMarkupContent(hover.contents)) {
            return splitLines(hover.contents.value);
          }
        }).map((lines) =>
          lines?.join("\n") ?? ""
        ).join("\n\n");

        const width = Math.min(
          opts.max_width ?? 160,
          content.split("\n").map((line) => line.length).reduce(
            (a, b) => Math.max(a, b),
            0,
          ),
        );
        const height = Math.min(
          opts.max_height ?? 20,
          content.split("\n").length,
        );

        const window = await createPopup(denops, content, {
          relative: "cursor",
          width,
          height,
          title: opts.title,
          border: opts.border,
          zindex: opts.zindex,
          row: opts.offset_y ?? 2,
          col: opts.offset_x ?? 2,
        });

        const id = lambda.register(denops, window.close, { once: true });
        await autocmd.define(
          denops,
          "CursorMoved",
          "*",
          expr`eval(denops#request(${denops.name}, ${id}, []))`,
          { once: true },
        );
      },
    });
  }
}
