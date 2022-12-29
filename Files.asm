todo 'Make cool Files History management'
todo 'Use last results of searching'
todo 'Check max size of directory'

;Input:
;es:ax -> buffer for file
;ds:dx -> DirFileRec for File
;cx -> reading option:
;cx = 0: Unlimited reading (for future compability)
;cx
;Unlimited reading
;Output:
;file at own place
;
Files.readFile:
push bx di
    mov bx, dx
    mov di, ax
    call readFile
pop di bx
ret

;Input:
;None:
;Output:
;al - default disk number (not logical as 0, but real physical num)
;
Files.getDefaultDisk:
push es
     push DOS_SEG
     pop es
     mov al, byte [es: FAT_SERVICES_ADDR + FatServiceRec.paramBlock + DPBRec.bDrvNum]
pop es
ret


;Input:
;al - new physical disk
;ah - new disk label (not letter: starts with 0, 1, ...)
;Output:
;ax = 0 -> successfully changed
;else -> no such devices
;
Files.setDefaultDisk:
push es
      push DOS_SEG
      pop es
      mov byte [es: FAT_SERVICES_ADDR + FatServiceRec.paramBlock + DPBRec.bDrvNum], al
      add ah, 'A'
      mov byte [es: Files.sDefaultDisk + 1], ah
pop es
ret

MAX_DISK_NUMBER = 3
Files.arrDisk String[MAX_DISK_NUMBER]

;this routine doesn't check correctness -> only extracting
;replace dirSeparator to length (for internal needs onl
;Input:
;ds:dx - address of FilePath as ZString
;Output:
;ax <> 0 -- Impossible path
;ax = 0 work correct
;es:dx - address of array of Processable PString (length, data, length, data, ... 0)
;ds, es are corrupted
;
Files.extractStatement:
prolog
setLocals bPathLen, bLastInd
push bx
      mov ax, dx
      call Statements.convertToFullPath
      mov byte [bPathLen], dl ;generally dx
      push es
      pop ds
      call ZString.toPString
      mov bx, ax

      mov al, DIR_SEPARATOR
      mov dx, bx
      call String.append
      inc byte [bPathLen]
.Extracting:
      mov byte [bLastInd], 4  ;length('C:\') + 1
.extLoop:
      mov ah, byte [bLastInd]
      mov al, DIR_SEPARATOR
      mov dx, bx
      call String.getPos
      test ax, ax
      jz .errorExit

      mov ah, al
      mov al, byte [bLastInd]
      mov byte [bLastInd], ah
      inc byte [bLastInd] ;the next char
      call .insertLength

      mov al, byte [bLastInd]
      cmp al, byte [bPathLen]
      jae .stopLoop
      jmp .extLoop
.stopLoop:
      mov byte [bx], 2 ;C: -> only
      push bx
      movzx ax, byte [bLastInd]
      add bx, ax
      mov byte [bx - 1], 0 ;end of the PString sequence
      pop bx
.noErrors:
      xor ax, ax
      mov dx, bx
      jmp .finish
.errorExit:
       mov ax, 1
.finish:
      pop bx
      epilog
ret
;internal routine
;Input:
;al - last index  (the data char; not PString begining)
;ah - curr index
;bx - start of PString
;
.insertLength:
   push bx
   movzx dx, al
   sub ah, al ;curr length
   add bx, dx
   mov byte [bx - 1], ah
   pop bx
ret

;Input:
;None;
;Output:
;Save empty Dta in buffer
;Assumes: ds is set to current segment
proc Files.initDta uses di es
  mov cx, sizeof.LastFileInfo
  mov di, Files.ServiceFileInfo
  push di
  cld
  mov al, 0
  rep stosb
  pop di
  mov byte [di + LastFileInfo.bInfoSign], LastFileInfo.isDamaged

  call setDta.getLastItem
  mov di, ax
  mov dx, word [es:di] ;offset
  mov ax, word [es:di + 2]; segment
  push ax
  pop es
  mov di, dx
  mov byte [es:di + LastFileInfo.bInfoSign], LastFileInfo.isDamaged
 ret
endp

;Input:
;ax - address of DirFileRec to store
;dx - address of FileName as PString
;
proc Files.storeFileInfo uses si di
   push ax
   mov ax, dx
   call Files.extractName
   mov si, ax
   pop ax
   push ax ;save ax
   ;in si -> DirFileRec
   call Files.isSearchResult ;exessive in future should be remove (probably new functions will be added)
   test ax, ax
   pop ax ;restore it
   jnz .notResult

   mov di, Files.ServiceFileInfo.sShortName
   mov cx, sizeof.ShortName
   cld
   rep movsb
   ;mov ax, ax
   call storeFileInfo
   jmp .finish
.notResult:
   stc
   mov ax, FILE_NOT_FOUND
.finish:
ret
endp

;Input:
;ax - DirFileRec
;Output:
;at lastDTA file info
;
storeFileInfo:
push si di es
     push ax
     call setDta.getLastItem ;get addr of last dta: offset: seg
     mov si, ax
     mov di, word [si]
     mov es, word [si + 2]
     pop si
     mov ax, di ;mov es, es
     add ax, FileInfoRec.szFilePath
     mov dx, si
     add dx, DirFileRec.sFileName
     call ShortName.copy

.copyMainInfo:
     mov ax, word [si + DirFileRec.wCrtTime]
     mov word [es:di + FileInfoRec.wCrtTime], ax

     mov ax, word [si + DirFileRec.wCrtDate]
     mov word [es:di + FileInfoRec.wCrtDate], ax

     mov al, byte [si + DirFileRec.bFileAttr]
     mov byte [es:di + FileInfoRec.bAttr], al
     mov eax, dword [si + DirFileRec.dFileSize]
     mov dword [es:di + FileInfoRec.dFileSize], eax

.copyServiceInfo:
     mov si, Files.ServiceFileInfo
     call Files.getSearchAttr
     mov word    [si + LastFileInfo.wSearchAttr], ax
     mov byte [si + LastFileInfo.bInfoSign], LastFileInfo.isCorrect
     mov cx, sizeof.LastFileInfo
     rep movsb
     clc
pop es di si
ret


;Note: this routine not ensure that this record is correct (previously,
;should be read file)
;Input:
;None;
;Output:
;es:ax - address of last touched DirFileRec
Files.getLastFile:
       push DOS_SEG
       pop es
       mov ax, Files.bufferRec
ret

;Input:
;ax - result code (error or no)
;es:dx - address of Founded DirFileRec
;Output:
;ax - result code (saved)
;es:dx - address of Founded DirFileRec (input and output can be changed)
;
Files.saveSearch:
       push ax ds
       s_xchg es, ds
       ;mov dx, dx
       mov ax, Files.bufferRec
       call Files.copyRec ;to Files.bufferRec
       pop ds ax
       mov dx, Files.bufferRec
ret

;max size of system buffer is 4 KiB
SYSTEM_BUFFER_FREE equ 0x3
SYSTEM_BUFFER_BUSY equ 0xC
SYSTEM_BUFFER_PAGE_SIZE equ 100
sizeof.SystemBufferHandle equ 2
SYSTEM_BUFFER_PAGE_NUM  equ (sizeof.SystemBuffer / (sizeof.SystemBufferHandle + SYSTEM_BUFFER_PAGE_SIZE) )
;Init system buffer
System.initBuffer:
push es di
     push DOS_SEG
     pop es
     mov di, SYSTEM_BUFFER_ADDR
     mov cx, SYSTEM_BUFFER_PAGE_NUM
     mov ax, SYSTEM_BUFFER_PAGE_SIZE
     or ax, (SYSTEM_BUFFER_FREE shl 12)
     cld
.touchLoop:
     stosw
     add di, SYSTEM_BUFFER_PAGE_SIZE
     loop .touchLoop
pop di es
ret
;Note: this version doesn't not supported changing block size
;Input:
;ax - length of the buffer (max size is 4 KiB)
;Output:
;es:ax - free buffer
;
System.getBuffer:
push bx
        push DOS_SEG
        pop es
        and ax, 0x0FFF
        push ax
        xor ax, ax ;omg)
        or ax, (SYSTEM_BUFFER_FREE shl 12)
        mov bx, SYSTEM_BUFFER_ADDR
        mov cx, SYSTEM_BUFFER_PAGE_NUM
.searchLoop:
        push ax
        and ax, word [es:bx]
        pop ax
        jnz .wasFound
        add bx, SYSTEM_BUFFER_PAGE_SIZE + 2
        loop .searchLoop
.allBusy:
        mov ax, SYSTEM_BUFFER_ADDR + 2 ;doesn't matter)
        jmp .finish
.wasFound:
        mov ax, (SYSTEM_BUFFER_PAGE_SIZE or (SYSTEM_BUFFER_BUSY shl 12) )
        mov word [es: bx], ax
        add bx, 2
        mov ax, bx
.finish:
        pop cx    ;was on stack
pop bx
ret

;Input:
;
System.hardFreeBuffer:
        push ax
        pushf
        call System.freeBuffer
        popf
        pop ax
ret
;es:ax -> old pointer
;
System.freeBuffer:
push bx
      mov bx, ax
      mov word [es: bx - 2], ( (SYSTEM_BUFFER_FREE shl 12) or (SYSTEM_BUFFER_PAGE_SIZE) )
pop bx
ret
;Input:
;ax -> error type
;Output:
;System has been died
;
System.printError:
       mov ah, 09h
       push DOS_SEG
       pop ds
       mov dx, Statements.BuffDamaged
       int 21h

       mov ah, 09h
       mov dx, Statements.Reboot
       int 21h
.infinityLoop:
        nop
        jmp .infinityLoop
;ret

Statements.BuffDamaged DString = 'System buffer has been corrupted'
Statements.Reboot DString = 'Reboot system'

MAX_FULL_PATH_LENGTH equ 255 ;strict limit
;not working
;Input:
;ds:ax -> full Path (or with skipped disk) ZString
;Output:
;es:ax -> excatly full Path (ds is saved) ZString
;dx - length of new string
;No errors check -> only additional copy
proc Statements.convertToFullPath uses si di bx
local pBuffer : WORD
        mov si, ax
        call ZString.length
        mov bx, ax ;save length
        push ax
        mov ax, MAX_FULL_PATH_LENGTH
        call System.getBuffer
        mov word [pBuffer], ax
        mov di, ax
        cmp byte [ds:si + 1], ':'
        je .skipAdding
        call .copyDisk
        add bx, 3
.skipAdding:
        mov ax, di
        mov dx, si
        pop cx
        call ZString.copy
        mov ax, word [pBuffer]
        mov dx, bx
ret
endp
;Input:
;es:di -> destination
;df is clear
;Output:
;di + offset
.copyDisk:
push si ds
push DOS_SEG
pop ds
    cld
    mov si, Files.sDefaultDisk
    lodsb
    movzx cx, al
    rep movsb
pop ds si
ret
;Note:
;automatically add default disk label if it has beem ommited
;assume name is correct
;Input
;ds:ax - address of full path
;Output:
;ax = 0 : no errors
;ds:dx - address of new statement with rejected last (main_part, 0, last_name, 0): ZString    (replace \ to 0)
;ds:cx - offset to last name
;else in ax error code
;Processable last name .length = length + 2 (zero and offset zero)
Statements.rejectLast:
prolog
push es di bx
        mov di, ax
        mov bx, ax
        mov dx, MAX_FULL_PATH_LENGTH
        call ZString.length
        mov cx, ax
        add di, ax ;es:di is zero
        dec di
        std
        mov al, '\'
        repne scasb
        jcxz .errorPath ;no char???
        mov byte [es:di + 1], 0
        ;mov cx, cx
        mov dx, bx
        xor ax, ax
        mov cx, di
        add cx, 2
        jmp .finish
.errorPath:
        mov ax, PATH_NOT_FOUND
.finish:
pop bx di es
epilog
ret


;Input:
;ds:ax - ZString of Path
;Output:
;ax = 0: yes, has
;else -> hasn't
;ds - not corrupted
Statements.hasWildCards:
push si
        mov si, ax
        mov dl, '?'
        mov dh, '*'
        mov cx, $FF ;max_length
        cld
.searchLoop:
        lodsb
        test al, al
        jz .noWildCards ;ZString was ended

        cmp al, dl
        sete ah
        cmp al, dh
        sete al
        or al, ah
        jnz .hasWildCards
        dec cx
        jcxz .noWildCards
        jmp .searchLoop

.hasWildCards:
        xor ax, ax
        jmp .finish
.noWildCards:
        mov ax, -1
.finish:

pop si
ret


;Input:
;ds:dx - address of ZString (full path or with skipped default disk)
;cx - attributes
;assume curr segment is DOS_SEG (0)
proc Files.createFile uses ds es bx
local wFileAttr    : WORD
local pLastName    : WORD
local bIsRoot      : BYTE
         mov word [wFileAttr], cx
         mov ax, dx
         call Statements.convertToFullPath
         mov bx, ax    ;es:bx -> start of the erasedPath
         push es
         pop ds
         ;mov ax, bx
         call Files.isFileExists   ;check that this file is already exists
         jnc .fileExists
         mov ax, dx ;ds:
         call Statements.isRootFilePath
         mov byte [bIsRoot], al
         mov ax, bx
         call Statements.rejectLast  ;buffer in the current segment
         test ax, ax
         jnz .noParents
         mov word [pLastName], cx ;the beginning of a Last Name

         mov al, byte [bIsRoot]
         test al, al
         jz .createRootFile

         mov ax, dx
         call Files.isFileExists  ;check that parents exists and it possible to add
         jc .noParents
.createDirFile:
         call Files.getLastFile ;es:ax -> DirFileRec
         mov dx, ax ;es:dx -> DirFileRec
         mov ax, word [pLastName]
         mov cx, word [wFileAttr]
         call Files.createDirRec
         clc
         jmp .finish
.createRootFile:
        mov ax, word [pLastName];ds is set to curr segment
        mov dx, word [wFileAttr]
        call Files.createRootRec
        clc
        jmp .finish
.noParents:
        mov ax, PATH_NOT_FOUND
        stc
        jmp .finish
.fileExists:
         mov ax, ERROR_FILE_EXISTS
         stc
.finish:
         push ax
         pushf
         mov ax, bx
         call System.freeBuffer
         popf
         pop ax
.afterFree:
ret
endp

;Input:
;ds:ax  - ZString (file name)
;dx - file attributes
Files.createRootRec:
     push dx
     call ZString.toPString
     call Files.extractName
     pop cx
     call createRootRec
ret

;Input:
;ds:ax - ZString (only file name)
;es:dx - DirFileRec
;cx - attributes
Files.createDirRec:
      push dx cx
      call ZString.toPString
      call Files.extractName
      pop cx dx
      call createDirRec

ret

Fn_3Ah_21h equ Files.deleteDir
;Input:
;ds:dx - FullPath as ZString (or without disk)
;Output:
;if cf -> in ax errorCode
Files.deleteDir:
push bx
      mov bx, dx
      mov ax, dx
      mov cx, ATTR_DIRECTORY
      call Files.findFile
      jc  .errorExit
      mov dx, bx
      call Files.deleteFile
.errorExit:
pop bx
ret

Fn_41h_21h equ Files.deleteFile
;Input:
;ds:dx - FullPath as ZString (or without disk)
;Output:
;if cf -> in ax errorCode
proc Files.deleteFile uses ds es bx
      mov bx, dx
      mov ax, dx
      call Statements.hasWildCards
      test ax, ax
      jz .noSuchFile_before

      mov ax, bx
      call Statements.convertToFullPath ;es:ax is result
      mov bx, ax
      push es
      pop ds
      call Files.isFileExists
      jc .noSuchFile
      call Files.getLastFile ;es:ax -> last DirRec
      call Files.isDirectory
      test ax, ax
      jnz .skipDirCheck
      call Files.getLastFile
      call Files.isEmptyDir
      test ax, ax
      jnz .notEmptyDir
.skipDirCheck:
      mov ax, bx
      call deleteFile
      jc .notEmptyDir
.wasDeleted:
      clc
      jmp .makeFree
.noSuchFile:
      mov ax, FILE_NOT_FOUND
      stc
      jmp .makeFree
.notEmptyDir:
      stc
      mov ax, ERROR_NOT_DELETABLE
      ;in ax -> error code
.makeFree:
      pushf
      push ax ;save error code
      push ds
      pop es
      mov ax, bx
      call System.freeBuffer
      pop ax
      popf
      jmp .finish
.noSuchFile_before:
      mov ax, FILE_NOT_FOUND
.finish:
ret
endp

;Input:
;ds:ax - Full Path (exactly): ZString
;Output:
;if cf : in ax -> error code (not exists)
;ds:dx - Full Path
proc Files.isFileExists
      mov cx, ATTR_ALL_FILES
      call Files.findFile
ret
endp

;Input:
;ds:ax -> Full Path
;cx -> file attributes
;Output:
;if cf -> not found
;else -> was found
;ds:dx -> save (Full Path)
proc Files.findFile uses bx es
      mov bx, ax
      push ds
      pop es
      push cx
.setDummyDta:
      mov dx, DTA.buffer
      mov ax, DtaType.onLaunch
      push DOS_SEG
      pop ds
      call setDta

      push es
      pop ds
.correctFileName:
      mov ax, bx
      call Statements.hasWildCards
      test ax, ax
      jnz .searchFile
.noFile:
      stc
      jmp .skipSearch
.searchFile:
      mov dx, bx ;ds:dx -> Full Path
      pop cx
      call findFirstFile     ;is possible that only Root -> is root
.skipSearch:
      pushf
      push ax
      call Dta.removeLast ;dta is not used
      pop ax
      popf
      mov dx, bx
ret
endp

;Notes: it's only basic routine that works with correct filePath
;raw, low-level routine that exactly delete file
;before invoking you should check
;1) that file exists
;2) correctness of FilePath  (ZString)
;Input:
;ds:ax - Full FilePath (exactly)
;Output:
;if cf -> in ax errorCode
todo 'if read-only : forbidden to delete'
proc deleteFile uses es bx
local pLastName: WORD
local bIsRoot  : BYTE
     mov bx, ax
     call Statements.isRootFilePath
     mov byte [bIsRoot], al
     mov ax, bx
     call Statements.rejectLast
     test ax, ax
     jnz .finish
     mov bx, dx
     mov ax, cx
     call ZString.toPString
     mov word [pLastName], ax

     movzx ax, byte [bIsRoot]
     test ax, ax
     jnz .dirFile
.rootFile:
     mov ax, word [pLastName]
     xor dx, dx
     call Files.removeRootRec
     jmp .finish
.dirFile:

     mov ax, bx
     mov cx, ATTR_ALL_FILES
     call Files.findFile
     jc .finish
     call Files.getLastFile
     mov bx, ax
     mov dx, word [es: bx + DirFileRec.wClusterLo]
     mov ax, word [pLastName]
     call Files.removeDirRec
.finish:

ret
endp
;Note: determine file is RootBased or no
;      not check existing and correctness of statement
;      not check any mistake (only task)
;Input:
;ds:ax -> full Path (exactly full) as ZString
;Output:
;ax = 0  -> is RootFilePath   (less part)
;ax <> 0 -> is not root
proc Statements.isRootFilePath uses di es
     push ds
     pop es
     mov di, ax
     call ZString.length
     mov cx, ax
.dirFormatCheck:
     ;cmp byte [ds:di + 1], ':'
     ;setz al
     ;cmp byte [ds:di + 2], '\'
     ;setz ah
     ;and al, ah
     ;jz .notRoot
.statementCheck:
     cld
     add di, 3 ;the start of the file
     sub cx, 3
     mov al, '\'
     repne  scasb
     test cx, cx
     jnz .notRoot
     xor ax, ax
     jmp .finish
.notRoot:
     cmp byte [di - 1], al
     sete al
     cbw
.finish:
     ret
endp

;Input:
;ds:ax -> FileName as PString
;Output:
;if cf -> in ax errorCode
Files.removeRootRec:
        call Files.extractName
        call removeRootRec

ret

;Note: also free all clusters
;Input:
;ds:ax -FileName as PString
;dx -> cluster num
;Output:
;if cf -> if ax errorCode
Files.removeDirRec:
        push dx
        call Files.extractName ;  ds:ax
        pop dx
        call removeDirRec

ret

;Note: make DirFileRec as Free
;Input:
;ds:ax -> existing name  (ZString)
;Output:
;ax  =  0 : success
;ax <> 0  : error
;save old DirFileRec as LastFile
proc Files.eraseRootRec uses bx es ds
        local wBuffSeg : WORD
        mov bx, ax
        mov ax, EmptyFileRec.Deleted
        call Files.initEmptyRec
        mov word [wBuffSeg], es
        xchg ax, bx ;ds:ax -> old file name; es:bx -> deleted file
        call ZString.toPString
        call Files.extractName ;ds:ax -> FileName as ShortName
        xor dx, dx
        call getRootRec
        test ax, ax
        jnz .errorExit
        push dx es
        call Files.saveSearch
        pop es ax ;restore origin address
        mov ds, word [wBuffSeg]
        mov dx, bx
        call Files.copyRec
        call RootBuffer.flush ;deleteFile
        xor ax, ax
.errorExit:
.finish:
        pushf
        push ax
        mov ax, bx
        mov es, word [wBuffSeg]
        call Files.freeRec
        pop ax
        popf
ret
endp

;Input:
;ds:ax - existing name (single File, as ZString)
;es:dx - Parent DirFileRec
;Output:
;ax = 0 : success
;else -> error code (other -> as eraseRootRec)
proc Files.eraseDirRec uses di bx es ds
        local wBuffSeg : WORD
        mov di, dx
        mov di, word [es:di + DirFileRec.wClusterLo] ;save parent cluster
        mov bx, ax
        mov ax, EmptyFileRec.Deleted
        call Files.initEmptyRec
        mov word [wBuffSeg], es
        xchg ax, bx ;ds:ax -> old file name; es:bx -> deleted file
        call ZString.toPString
        call Files.extractName ;ds:ax -> FileName as ShortName
        mov dx, ax
        mov ax, di ;start cluster
        xor cx, cx
        call getDirRec
        test ax, ax
        jnz .errorExit
        push dx es
        call Files.saveSearch
        pop es ax  ;restore origin address
        mov ds, word [wBuffSeg]
        mov dx, bx
        call Files.copyRec
        call Cluster.flush ;deleteFile
        xor ax, ax
.errorExit:
.finish:
        push ax
        mov ax, bx
        mov es, word [wBuffSeg]
        call Files.freeRec
        pop ax
ret
endp

;Input:
;ds:ax -> new file name (as ZString)
;es:dx -> old DirFileRec
;onStack: lp ParentDirFileRec
;Output:
;ax = 0 -> successuffuly
;else = errorCode
proc Files.updateDirRec uses bx si,\
     lpParentDirRec  : DWORD

     local pNewName  : WORD
     local wDirSeg   : WORD
     mov si, dx
     mov word [wDirSeg], es
     call ZString.toPString ;ds:ax
     call Files.extractName ;ds:ax
     mov word [pNewName], ax
     push ds ax

     push es si ;old name to stack because DirFileRec starts with name
     movzx dx, byte [es:si + DirFileRec.bFileAttr] ;prepare attributes

     push word [lpParentDirRec + 2]
     pop es
     mov bx, word [lpParentDirRec]
     mov ax, word [es:bx + DirFileRec.wClusterLo]
     mov bx, ax ;save cluster of parent's directory
     call updateDirRec
     test ax, ax
     jnz .errorExit
     mov ax, bx ;cluster num
     mov dx, word [pNewName]
     xor cx, cx
     call getDirRec
     ;es:dx -> self record
     mov ax, dx
     push word [wDirSeg]
     pop ds
     mov dx, si
     call Files.copyPartRec
     call Cluster.flush
     xor ax, ax
     jmp .finish
.errorExit:
     ;mov ax, ax
.finish:
ret
endp

;Input:
;ds:ax -> new file name (ZString);
;es:dx -> old DirFileRec
;Output:
;ax updateDirRec
proc Files.updateRootRec uses bx
     local wSavedSeg     : WORD
     local pNewName      : WORD
     mov word [wSavedSeg], es
     mov bx, dx ;save bx
     call ZString.toPString ;ds:ax
     call Files.extractName ;ds:ax
     mov word [pNewName], ax
     push ds ax
     push es bx
     movzx ax, byte [es:bx + DirFileRec.bFileAttr]
     call updateRootRec
     test ax, ax
     jnz .errorExit
     mov ax, word [pNewName]
     ;mov ds, ds
     xor dx, dx
     call getRootRec ;es:dx
     ;not check because error can be occured on the last func
     mov ax, bx
     mov ds, word [wSavedSeg]
     xchg ax, dx ;es:ax -> RootBufferRec; ds:dx -> saved old rec
     call Files.copyPartRec
     call RootBuffer.flush
     xor ax, ax
.errorExit:
      ;mov ax, ax
ret
endp

;Notes: copy attributes, filesize, cluster num (without name)
;Input:
;es:ax -> destination DirFileRec
;ds:dx -> source DirFileRec
Files.copyPartRec:
push di si
     mov di, ax
     mov si, dx
     mov al, byte [ds:si + DirFileRec.bFileAttr]
     mov byte [es:di + DirFileRec.bFileAttr], al

     mov ax, word [ds:si + DirFileRec.wClusterLo]
     mov word [es:di + DirFileRec.wClusterLo], ax

     mov eax, dword [ds:si + DirFileRec.dFileSize]
     mov dword [es:di + DirFileRec.dFileSize], eax
pop si di
ret

;Input:
;ax - address of ShortFileName as PString
;dx - rec num
;Output:
;ax = 0 -> no Errors
;ax <> 0 -> errorCode
;dx - addr of DirFileRec (this segment)
Files.getRootRec:
     ;mov ax, ax
     push dx
     call Files.extractName ;proccessable Short Name
     ;mov ax, ax
     pop dx
     call getRootRec

     inc cx ;change to the next start rec
     mov word [Files.ServiceFileInfo.wStartRec], cx ;correct or not -> high level problem
     mov byte [Files.ServiceFileInfo.bIsRoot], 1 ;yes, it's root

     push ax
     call Files.getSearchDisk
     mov byte [Files.ServiceFileInfo.bDrvNum], al
     pop ax

     call Files.saveSearch
ret


;Input:
;ax - address of ShortFileName as PString
;dx - directory cluster
;cx - start rec
;use saved offset in directory (not now)
;Output:
;ax = 0 -> no Errors
;ax <> 0 -> errorCode
;dx - addr of DirFileRec (this segment)
Files.getDirRec:
push bx
      mov bx, dx
      push cx
      call Files.extractName
      mov dx, ax
      mov ax, bx
      pop cx
      call getDirRec
      test ax, ax
      jne .noDirectory

      ;Files.saveSearch
      mov word [Files.ServiceFileInfo.wClusterNum], cx
      push ax
      call Files.getSearchDisk
      mov byte [Files.ServiceFileInfo.bDrvNum], al
      pop ax
      mov byte [Files.ServiceFileInfo.bIsRoot], 0
      push ax ;empty value to change
      call .getStartRec
      pop word [Files.ServiceFileInfo.wStartRec]

.noDirectory:
      call Files.saveSearch
pop bx
ret
;use hacky implementation of getDirRec (start with 0 offset of segment)
;Input:
;es:dx - address of curr record
;Output:
;on stack new value
.getStartRec:
push bp
mov bp, sp
push ax dx cx
     mov cx, sizeof.DirFileRec
     mov ax, dx
     cwd
     div cx;in ax id of curr file rec
     inc ax
     mov word [bp + 4], ax
pop cx dx ax
mov sp, bp
pop bp
ret
;Input:
;ds:ax - address of source PString (it can be changed) (source PString)
;Output:
;ds:ax - address of result String as ShortName
Files.extractName:
push si di
     mov si, ax
     mov di, Files.sEmptyShortName
     mov byte [di], sizeof.ShortName ;as PString

     mov dx, ax
     call Text.UpperCase

     mov ax, di
     call Statements.mappedChange

     mov dx, di
     mov al, ' '
     call String.fillChar

     cld
     lodsb
     cbw
     mov dx, sizeof.ShortName
     call getMinMax
     movzx cx, al   ;ch - curr index; cl - max num of index
     stosb ;nothing usefull
.castLoop:
     cmp ch, cl
     jae .stopLoop

     lodsb
     inc ch ;the next input

     cmp al, '.'
     je  .readExt

     cmp al, '*'
     je .fillRest

     jmp .writeChar
.readExt:
     ;fill spaces 9, 10, 11 positions
     mov di, Files.sEmptyShortName + 9
     push cx
     mov cx, 3
     push di
     mov al, ' '
     rep stosb
     pop di
     pop cx
     jmp .castLoop

.fillRest:
     mov dx, di
     sub dx, Files.sEmptyShortName ;char offset from the beginig
     mov ax, sizeof.ShortName
     sub ax, dx ;rest
     inc ax ;11 - 9 = 2...
     push cx
     mov cx, ax
     mov al, '?'
     rep stosb
     pop cx
     jmp .castLoop

.writeChar:
     cmp di, Files.sEmptyShortName + sizeof.ShortName
     ja .castLoop

     stosb
     jmp .castLoop
.stopLoop:

     mov ax, Files.sEmptyShortName
     inc ax ;skip String length

pop di si
ret

;Input:
;ds:ax - source PString
;Output:
;ds:ax (save)
Statements.mappedChange:
push di
     mov di, ax
     cmp byte [ds:di + 1], fnFreeFile
     jne .skip
     mov byte [ds:di + 1], 0x05
.skip:
pop di
ret
;Input:
;ds:ax -> DirFileRec
;Output:
;ax = 0 -> directory
;ax <> 1 -> not directory
Files.isDirectory:
push bx
      mov bx, ax
      test byte [bx + DirFileRec.bFileAttr], ATTR_DIRECTORY
      setz al
      cbw
pop bx
ret

;Input:
;es:ax -> address of dest record
;ds:dx -> address of source record
;Output:
;es:ax -> saved
;ds:dx -> saved
Files.copyRec:
    push di si
    cld
    mov di, ax
    mov si, dx
    mov cx, sizeof.DirFileRec
    rep movsb
    pop si di
ret
;Input:
;None
;Output:
;al -> disk number
Files.getSearchDisk:
     call getDefaultDisk
ret
;Input:
;ds:dx -> origin file path (to determine search disk)
;cx - file attributes
;Output:
;save all registers
Files.initSearch:
push ds
     push DOS_SEG
     pop ds
     mov byte [Files.bSearchAttr], cl
pop ds
ret

;Input:
;cx - file attributes
;Output:
;nothing is affected
Files.setSearchAttr:
push ds
     push DOS_SEG
     pop ds
     mov byte [Files.bSearchAttr], cl
pop ds
ret
;Assume: ds is DOS_SEG
;Input:
;ax (offset in curr seg) DirFileRec
;Output:
;ax = 0 -> is result
;else is not result
Files.isSearchResult:
push bx
     mov bx, ax
     mov al, byte [Files.bSearchAttr]
     test byte [bx + DirFileRec.bFileAttr], al
     setz al ; if not matched -> in al: 1; else -> 0
     cbw
pop bx
ret
;Assume: ds is DOS_SEG
;Input: none;
;Output:
;ax -> search attribyte
Files.getSearchAttr:
      movzx ax, byte [Files.bSearchAttr]
ret

Files.bSearchAttr  db ?
Files.wBytesCnt    dw ?
Files.sDefaultDisk PString = "C:\"
Files.sEmptyShortName PString[sizeof.ShortName] ;use only Files.extractName (PString for Service functions)
Files.ServiceFileInfo LastFileInfo
Files.bufferRec DirFileRec ;use as last FileInfo