# lspoints-hover

This plugin is a hover extension for [lspoints](https://github.com/kuuote/lspoints).
Only Neovim will be supported from now on for a while.

## Usage

```init.vim
call lspoints#load_extensions(['hover']) " load hover with other extensions

function s:lspoints_on_attach() abort
  nnoremap <buffer> K <Cmd>call denops#request('lspoints', 'executeCommand', ['hover', 'execute'])<CR>
endfunction

autocmd User LspointsAttach:* call s:lspoints_on_attach()
```
