import 'some_macro'
;@Declare {struct}
struc DirFileRec
{
  .sFileName String[11]
  .bFileAttr db
}

SYSTEM_BUFFER_FREE equ 0x3
SYSTEM_BUFFER_BUSY equ 0xC
SYSTEM_BUFFER_PAGE_SIZE equ 100
sizeof.SystemBufferHandle equ 2
SYSTEM_BUFFER_PAGE_NUM  equ (sizeof.SystemBuffer / (sizeof.SystemBufferHandle + SYSTEM_BUFFER_PAGE_SIZE) )

;Input: None
;Output: None
;Notes: Init system buffer
;
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

;Input:
;ds:ax -> ZString of Path
;Output:
;ax = 0 -> yes, has
;else -> hasn't
;Notes:
;ds not corrupted
;
proc Statements.hasWildCards:
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
endp
