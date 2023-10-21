# lspoints-hover

This plugin is a hover extension for [lspoints](https://github.com/kuuote/lspoints).
Only Neovim will be supported from now on for a while.

## Usage

```init.vim
call lspoints#load_extensions(['hover']) " load hover with other extensions

function s:lspoints_on_attach() abort
  nnoremap <buffer> K <Cmd>call denops#request('lspoints', 'executeCommand', ['hover', 'execute'])<CR>
  " you can pass these options
  "
  " title: string
  " border: string ('none' (default), 'single', 'double'... ) (please see nvim_open_win())
  " zindex: integer
  " wrap: boolean
  " max_width: integer
  " max_height: integer
  " offset_x: integer
  " offset_y: integer
  "
  " ex)
  " nnoremap <buffer> K <Cmd>call denops#request('lspoints', 'executeCommand', ['hover', 'execute', {'title': 'Hover', 'border': 'single'}])<CR>
endfunction

autocmd User LspointsAttach:* call s:lspoints_on_attach()
```
