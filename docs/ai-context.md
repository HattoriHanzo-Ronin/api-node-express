# Contexto del proyecto

## Convenciones de código

* Utilizar nombres descriptivos y consistentes
* Priorizar legibilidad sobre complejidad
* Priorizar soluciones simples frente a optimizaciones prematuras
* Mantener métodos pequeños siempre que sea razonable
* Extraer lógica repetida solo cuando aporte valor real
* No crear capas, helpers o abstracciones que solo añadan ruido
* Evitar duplicación de código
* Evitar abstracciones innecesarias
* Mantener el estilo compacto del proyecto
* Si cabe en una línea y sigue siendo legible, mantener inline
* No escribir sentencias `if` inline; utilizar siempre un bloque con llaves
* Permitir `if/else` simples cuando expresen claramente dos caminos
* Evitar cadenas `else if` y árboles con nuevos `if/else` anidados dentro de ambas ramas; preferir condiciones independientes, retornos o `continue` para mantener el flujo plano
* Usar `switch` cuando represente de forma más clara varios casos discretos
* Si después de un bloque `if` continúa más código en el mismo bloque, añadir una línea en blanco
* Declarar cada variable con su propio `const` o `let`; no agrupar varias declaraciones en una misma sentencia
* Nombrar las propiedades estáticas de clase en mayúsculas con palabras separadas por guiones bajos
* Mantener en archivos de configuración las constantes globales o que puedan necesitarse de forma global, como las variables de entorno
* Mantener como propiedades estáticas privadas de la clase las constantes que solo consume esa clase o que pertenecen a su responsabilidad
* No añadir saltos de línea innecesarios
* No añadir comentarios para explicar código evidente
* No partir cadenas o expresiones solo por estilo si la línea es legible y no excede claramente el límite horizontal
* Mantener `it` en callbacks simples cuando no se vaya a aprovechar destructuring
* No crear variables intermedias solo para satisfacer reglas de lint si el destructuring directo con `let` es más claro
* Al importar una constante de tipo objeto, acceder directamente a la propiedad si solo se utiliza una vez
* Hacer destructuring si se utilizan dos o más propiedades del objeto o si una misma propiedad se utiliza más de una vez
* Mantener preferentemente el nombre original de la propiedad al hacer destructuring; usar un alias descriptivo solo si evita confusión
* Mantener dentro de la clase como métodos privados los helpers que pertenezcan exclusivamente a su responsabilidad
* Conservar arrays y estructuras tipadas en los mapeos cuando otros componentes necesiten filtrarlos; convertirlos a texto únicamente en la capa de presentación final

## Tipado y JSDoc

* Tipar parámetros siempre que sea posible
* Usar el tipo más específico disponible que respete el contrato completo del parámetro
* El tipado y el JSDoc deben reflejar el contrato completo que recibe el método, no solo las propiedades que utiliza internamente
* Si un parámetro recibe un objeto completo, conservar y referenciar su tipo completo; no sustituirlo por un tipo parcial, un objeto inline reducido ni el tipo de una propiedad usada
* Por ejemplo, `params.authUser` recibe el objeto completo del usuario autenticado: debe documentarse con el tipo completo correspondiente aunque el método solo use `authUser.username`, nunca como `{ username: string }` ni como `string`
* Antes de documentar un parámetro, comprobar su contrato y los tipos existentes; no inferir ni redefinir el contrato a partir del uso local
* Evitar tipos genéricos cuando exista una alternativa más precisa
* Comentar los tipos base, como `ApiResponse` y `ApiErrorResponse`
* Comentar las interfaces reutilizadas por toda la aplicación
* Comentar los tipos cuyo propósito no sea evidente
* No comentar DTOs CRUD, como `LoginRequest`, `UserResponse` o `UpdateDeviceRequest`
* No comentar interfaces cuyo nombre explique claramente su función
* No documentar `params` como objeto intermedio
* Documentar directamente `params.id`, `params.data`, etc.
* No añadir `@returns` si la función no devuelve nada explícitamente
* Mantener coherencia en todo el proyecto

## Documentación

### Clases

* Todas las clases públicas deben estar documentadas
* La descripción debe ser breve y directa
* No usar punto final en las descripciones

Ejemplo:

```js
/**
 * Devices manager
 *
 * @author HattoriHanzo-Ronin
 */
```

### Métodos públicos

* Documentar los métodos públicos
* Las descripciones deben ser cortas y centradas en la responsabilidad del método
* Usar `Returns`, `Creates`, `Updates`, `Deletes`, `Inserts` según corresponda
* No sobreexplicar el funcionamiento interno

Ejemplo:

```js
/**
 * Returns a device by its identifier
 *
 * @param {string} params.id Device identifier
 * @returns {Promise<Object>} Device
 */
```

### Métodos privados

* Documentar únicamente cuando:

  * El nombre no explique claramente su comportamiento
  * Contengan lógica relevante
  * Realicen transformaciones complejas
  * Su funcionamiento no sea evidente a simple vista

* No documentar helpers privados evidentes

## Testing

* Mantener los tests fuera de `src`, dentro de `tests`
* Replicar bajo `tests` la estructura del código probado; por ejemplo, `src/utils` corresponde a `tests/utils`
* Probar comportamientos, no implementaciones
* Evitar tests duplicados
* Priorizar casos que aporten valor real
* Mantener tests compactos
* No añadir líneas en blanco innecesarias
* Mantener inline siempre que sea legible

## Decisiones de diseño

* Priorizar claridad sobre microoptimizaciones
* Cuando existan varias soluciones válidas, elegir la más simple y coherente con la arquitectura existente
* No mezclar responsabilidades
* Respetar la arquitectura y la ubicación existente de cada responsabilidad antes de crear archivos nuevos
* No replantear la arquitectura salvo que exista un problema real

## Forma de trabajo esperada

* No crear commits salvo que el usuario lo solicite explícitamente
* Cuando se soliciten commits, separar actualización de dependencias, implementación y tests en commits independientes
* Limitar los cambios estrictamente al alcance solicitado; no modificar, corregir ni refactorizar archivos o código que el usuario no haya pedido tocar
* Si se pide refactorizar, generar el código refactorizado directamente
* No responder con planes si se puede entregar el resultado
* No proponer alternativas salvo que haya una decisión real que tomar
* Si falta contexto, pedir todo el contexto necesario de una vez
* Si no se puede hacer algo, decirlo claramente y de forma inmediata
* Mantener las decisiones ya tomadas en el proyecto
