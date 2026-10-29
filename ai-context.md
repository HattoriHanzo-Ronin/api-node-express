# Project context

## Mandatory application of the context

* Before modifying code, read this entire document and turn its applicable rules into a concrete check for the requested scope
* Before considering a review complete, systematically check the entire scope against every applicable rule and correct every violation found
* Do not claim that a file, change, or project complies with this context without having run those proportionate checks and validations
* If a rule cannot be applied due to a contract, technical limitation, or explicit decision, report the exception and its reason before closing the work
* Do not expand the scope or alter unrequested contracts or behavior; if an additional change is necessary, identify it and request confirmation before applying it

## Code conventions

* Use descriptive and consistent names
* Prioritize readability over complexity
* Prioritize simple solutions over premature optimization
* Keep methods small whenever reasonable
* Extract repeated logic only when it provides real value
* Do not create layers, helpers, or abstractions that only add noise
* Avoid code duplication
* Avoid unnecessary abstractions
* Maintain the project's compact style
* If it fits on one line and remains readable, keep it inline
* Do not write inline `if` statements; always use a block with braces
* Allow simple `if/else` statements when they clearly express two paths
* Avoid `else if` chains and trees with new nested `if/else` statements inside both branches; prefer independent conditions, returns, or `continue` to keep the flow flat
* Use `switch` when it more clearly represents several discrete cases
* If more code continues in the same block after an `if` block, add a blank line
* Declare each variable with its own `const` or `let`; do not group multiple declarations in the same statement
* Name constants in uppercase with words separated by underscores, including reusable local regexes
* Name static class properties in uppercase with words separated by underscores
* Keep global constants, or those that may be needed globally, such as environment variables, in configuration files
* Keep constants that are only consumed by a class or belong to its responsibility as private static properties of that class
* Declare all module constants at the beginning of the file, after imports and before any class or function; always separate imports and constants with a blank line, keep those that share a responsibility together, and separate semantic groups, such as entities or shared dependencies, with a blank line
* Declare destructuring and constants in the narrowest scope possible; if only one method consumes them, obtain them inside that method. If several methods use the same properties, decide whether their shared use justifies keeping them at module scope
* Do not add unnecessary line breaks
* Do not add comments to explain obvious code
* Do not split strings or expressions only for style if the line is readable and does not clearly exceed the horizontal limit
* In arrow callbacks, destructure the properties used when the full object is not needed; when it must be retained, use a descriptive name instead of `it`
* Do not create intermediate variables only to satisfy lint rules if direct destructuring with `let` is clearer
* Do not add unreachable returns only to satisfy lint after a call that throws an error; TypeScript will control that flow when appropriate
* When importing an object-type constant, access the property directly if it is only used once
* Destructure if two or more properties of the object are used, or if the same property is used more than once
* When destructuring an object-type constant in a file, group all consumed properties in a single destructuring expression
* When consuming multiple properties from a nested object, use nested destructuring in a single expression; for example: `const { ERROR_MESSAGES: { typeRequired, typeNotRequired } } = ValidateUtils`
* Prefer keeping the property's original name when destructuring; use a descriptive alias only if it avoids confusion
* Do not unnecessarily rename destructured property names; keep the original name unless a descriptive alias prevents real confusion
* Local schema regexes are declared inline if they are used only once; keep them as local constants only when reused within the same schema
* Static properties and methods that can be destructured must reference other static properties or methods through the class name, never through `this`, to preserve their context when extracted
* Module helpers remain in the module unless they need to be exported; convert external helpers that are used only by a class into private methods of that class, unless doing so breaks a contract or creates a technical conflict
* Preserve typed arrays and structures in mappings when other components need to filter them; convert them to text only in the final presentation layer
* Service and facade methods must always receive an object as a parameter to allow their contract to be extended
* Methods in other layers that may grow must also receive an object as a parameter
* In routers and apps, group registrations by HTTP method and separate each group with a blank line; `use` forms its own middleware group

## Encapsulation and property access

Apply the principles of object-oriented programming encapsulation consistently, following Java conventions and adapting them to TypeScript features.

### 1. Internal class state

* Declare internal properties as `private` by default.
* Use `protected` when child classes need to access the state or extend its behavior.
* Avoid exposing internal properties directly through public fields.
* Keep state control within the responsible class.
* Separate the constructor from class properties with a blank line.

### 2. Getters and setters

* Use getters to expose encapsulated properties when access to them is needed.
* Implement setters only when a property is intended to be modifiable.
* Do not indiscriminately generate getters and setters for every property.
* Prefer native TypeScript accessors (`get` and `set`) over traditional Java methods (`getX()` and `setX()`) for simple access.
* Always declare getters and setters at the end of the public section of the class, immediately before private methods.
* Use specific methods when a modification represents a business operation or involves significant side effects.
* Do not allow external modification of properties that should only be read.

### 3. DTOs and data contracts

* DTOs defined as classes must follow the same encapsulation principles as other classes.
* Declare their properties as `private` or `protected`, according to inheritance needs.
* Expose their values through getters and allow modifications through setters when appropriate.
* Use getters only for read-only properties.
* Avoid unnecessary setters in immutable DTOs.
* Plain objects, interfaces, types, and configuration structures may use properties directly, without needing to create artificial classes or accessors.
* Maintain the property names and types established in public contracts.
* Ensure that introducing getters and setters does not alter DTO serialization or deserialization.
* When a DTO must be converted to JSON, ensure its properties are correctly included, using an appropriate serialization mechanism when necessary.

### 4. Interfaces and inheritance

* Interfaces must define public contracts without exposing internal implementation details.
* Declare properties as `readonly` when consumers should only read them.
* Public getters and setters can be represented as properties in interfaces.
* Do not include `private` or `protected` members in interfaces.
* Child classes should preferably use the available getters, setters, or methods, avoiding direct manipulation of inherited properties when controlled access exists.
* Use `protected` only when inheritance justifies it.

### 5. Compatibility and refactoring

* Maintain existing public contracts whenever possible.
* Prefer native getters when they improve encapsulation without changing the syntax used by consumers.
* Do not modify public contracts for aesthetic reasons alone.
* Review compatibility before replacing public properties with getters or setters.
* Consider serialization, enumerability, mutability, and runtime behavior.
* Avoid refactorings that add complexity without genuinely improving the architecture.

### 6. Access modifiers

* Omit `public`, as it is the default access modifier in TypeScript.
* Explicitly declare `private` and `protected` when appropriate.
* Use ECMAScript private fields (`#`) only when runtime privacy must be guaranteed.
* Do not use `protected` indiscriminately if a property can remain `private`.

### General principle

**Encapsulate the state and behavior of classes while maintaining clear and stable public contracts.**

Encapsulation must also apply to DTOs defined as classes, without imposing unnecessary accessors on plain objects, constants, or structures that do not require object-oriented behavior.

Prioritize architectural consistency, maintainability, and compatibility over the mechanical generation of getters and setters.

## Typing and JSDoc

* Type parameters whenever possible
* Use the most specific available type that respects the complete contract of the parameter
* Typing and JSDoc must reflect the complete contract received by the method, not only the properties it uses internally
* If a parameter receives a complete object, preserve and reference its complete type; do not replace it with a partial type, a reduced inline object, or the type of a used property
* For example, `params.authUser` receives the complete authenticated user object: it must be documented with the corresponding complete type even if the method only uses `authUser.username`, never as `{ username: string }` or `string`
* Before documenting a parameter, check its contract and existing types; do not infer or redefine the contract from local use
* Avoid generic types when a more precise alternative exists
* Document base types such as `ApiResponse` and `ApiErrorResponse`
* Document interfaces reused throughout the application
* Document types whose purpose is not obvious
* Do not document CRUD DTOs, such as `LoginRequest`, `UserResponse`, or `UpdateDeviceRequest`
* Do not document interfaces whose name clearly explains their purpose
* Do not document `params` as an intermediate object
* Document `params.id`, `params.data`, etc. directly
* Do not add `@returns` if the function does not explicitly return anything
* Maintain consistency throughout the project

## Documentation

### Classes

* All public classes must be documented
* The description must be brief and direct
* Do not use a period at the end of descriptions

Example:

```js
/**
 * Devices manager
 *
 * @author HattoriHanzo-Ronin
 */
```

### Public methods

* Document public methods
* Do not document controller handlers: their `req` and `res` contract is already defined by Express and JSDoc provides no useful information
* Descriptions must be short and focused on the method's responsibility
* Use `Returns`, `Creates`, `Updates`, `Deletes`, `Inserts` as appropriate
* Do not overexplain internal operation

Example:

```js
/**
 * Returns a device by its identifier
 *
 * @param {string} params.id Device identifier
 * @returns {Promise<Object>} Device
 */
```

### Private methods

* Document only when:

  * The name does not clearly explain its behavior
  * They contain relevant logic
  * They perform complex transformations
  * Their operation is not obvious at a glance

* Do not document obvious private helpers

## Testing

* Keep tests outside `src`, within `tests`
* Replicate the structure of the tested code under `tests`; for example, `src/utils` corresponds to `tests/utils`
* Test behavior, not implementations
* Avoid duplicate tests
* Prioritize cases that provide real value
* Keep tests compact
* Do not add unnecessary blank lines
* Keep inline whenever readable

## Design decisions

* Prioritize clarity over micro-optimizations
* When several valid solutions exist, choose the simplest one that is consistent with the existing architecture
* Do not mix responsibilities
* Respect the existing architecture and placement of each responsibility before creating new files
* Do not rethink the architecture unless there is a real problem
* Construct in `server-postgres` and inject instantiable dependencies with shared state or configuration; inject the class when it does not need to be instantiated or when each instance depends on data that is only available in the consuming logic
* In each router, apply protection middlewares to the specific routes and register `routeNotFound` at the end; this way a nonexistent route responds with 404 before an authentication error

## Expected way of working

* Do not create commits unless the user explicitly requests them
* When commits are requested, separate dependency updates, implementation, tests, and documentation according to their responsibility
* Strictly limit changes to the requested scope; do not modify, fix, or refactor files or code that the user has not asked to touch
* If refactoring is requested, generate the refactored code directly
* Do not respond with plans when the result can be delivered
* Do not propose alternatives unless there is a real decision to make
* If context is missing, request all necessary context at once
* If something cannot be done, say so clearly and immediately
* Maintain decisions already made in the project
* Every excluded file or directory must remain excluded, whether or not it is included in `.gitignore`
* Do not add, track, commit, remove, or reveal excluded files; their changes are kept locally only
