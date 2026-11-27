# Starting CAP servers in the background

Prefer new terminal windows on macOS or Windows (see the main skill). Use background mode on Linux, without a GUI terminal, or when a window isn't wanted.

On Linux/macOS, run `cds watch <project>` in the background with output redirected to a log file:

```sh
FORCE_COLOR=1 cds watch <project> > <logfile> 2>&1 &
```

- Background servers have **no** `tty`, so stop them with `kill <ppid>` only (the `close-terminals` script can't target them).
- They still register in `cds bindings` normally — discover them the same way.

## Watch the live log

On macOS or Windows with a GUI terminal, **offer to watch the live log** via the provided `watch-log` script. On Linux or without a GUI terminal, read the log file directly.

```sh
$/watch-log <logfile1> <logfile2> ...
```
