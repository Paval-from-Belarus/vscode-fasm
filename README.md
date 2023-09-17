# VSCode fasm extension x86-64
## What releas notes
- Add mnemonic enum/struct support (via additional declaration)
- Add file system highlitghting (in which file of project directory function was declared)
- Some small fixes of syntax highlitghting (and, obviously, new features)
- Add ".fasmignore" file (to eleminate indexation of specific files)
## What about the future?
- More flexible indexation 
  - Change index only for specific files
  - Make index more effective (rewrite on assembly))
- Highlights function's source file (remember file name for modules/functions)
- Smart refactoring (inside function or between label)
- Smart tips (`mov word [APPROPRIATE_PLACE]`) and input mistakes detection (tricky heuristics)
- Extended syntax for structures (tips about struct's fields) — new docs
- Add user's file to index
### Notes of using
- To specify compiler you should put path to fasm compiler or any wrapper script
  - The extension pass to compiler path to current file
- By default, extension search for settings.json in workspace
  - If you are using extension globally, path to compiler will be chosen as project path
    - Yes, extension assumes, that each project is really project
    - It's not suitable for stand-alone file editing
    - Probably, in future (but I afraid not) the support of indexation of compiler folder will be accepted automatically
*P. S. Everything was created for internal development needs*