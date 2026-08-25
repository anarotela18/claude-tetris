---
description: Crea un git worktree aislado y ejecuta ahi las instrucciones recibidas
---

Vas a crear un nuevo git worktree para trabajar de forma aislada e independiente del codigo principal, y luego ejecutar dentro de ese worktree las instrucciones que el usuario te dio.

Instrucciones del usuario: $ARGUMENTS

Pasos a seguir:

1. A partir de las instrucciones del usuario, determina un nombre corto, descriptivo y en kebab-case para el worktree (por ejemplo: `fix-scoring-bug`, `feature-multiplayer`, `refactor-render`). Este nombre se usara como nombre de carpeta y de rama.

2. Verifica que el directorio `.trees/` exista (creala si hace falta) y que no exista ya un worktree con ese nombre. Si ya existe, ajusta el nombre para que sea unico.

3. Crea el worktree con una rama nueva basada en la rama actual:

```bash
git worktree add .trees/<nombre> -b <nombre>
```

4. Cambia tu contexto de trabajo a ese worktree (usa la herramienta EnterWorktree si esta disponible, o trabaja explicitamente sobre la ruta `.trees/<nombre>` en todos los comandos y ediciones subsiguientes).

5. Ejecuta ahi, de manera aislada del codigo principal en el directorio raiz del repo, las instrucciones que el usuario proporciono en `$ARGUMENTS`.

6. Al finalizar, informa al usuario:
   - La ruta del worktree creado y el nombre de la rama.
   - Un resumen de los cambios realizados dentro del worktree.
   - Que el codigo principal (rama original, fuera de `.trees/<nombre>`) no fue modificado.
   - Los siguientes pasos posibles (revisar cambios, hacer merge, o eliminar el worktree con `git worktree remove .trees/<nombre>`).

Notas:
- No modifiques archivos fuera de `.trees/<nombre>` durante este comando.
- Si `$ARGUMENTS` esta vacio, pide al usuario que describa que quiere hacer en el worktree antes de continuar.
