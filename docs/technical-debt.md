# Technical debt

## AI discovery domain guard

### Problem

The Mini App AI `discovery` flow currently enforces the discovery output contract (exactly five ideas) even when the user's input is not a meaningful cosmetology/content-generation request.

Observed example: sending `привет` can still produce five discovery ideas. The model is therefore satisfying the discovery schema instead of rejecting or redirecting an out-of-scope/insufficient request.

### Required behavior

Before producing discovery ideas, the AI flow must determine whether the user's request is relevant to the product domain: cosmetology, skincare, aesthetic medicine, cosmetic products/procedures, or creation of content for a cosmetology practice.

For a relevant request, keep the existing discovery behavior and return exactly five ideas using the existing discovery contract.

For an out-of-scope or non-actionable request such as `привет`, a request about cars, cryptocurrency, or another unrelated subject, do not generate five fallback cosmetology ideas. Return a dedicated out-of-scope result that the Mini App can render as a short domain-specific guidance message, for example: `Я помогаю создавать публикации о косметологии. Укажите тему или выберите категорию.`

### Implementation constraint

Do not implement this as frontend keyword filtering. The domain decision belongs to the backend AI contract so that all clients receive the same behavior and the discovery schema cannot force unrelated input into five generated ideas.

A future implementation should extend the discovery result contract to represent both successful discovery and an explicit out-of-scope/non-actionable outcome, while preserving the current five-idea schema for valid requests.

This item is technical debt only. It does not change the current runtime behavior until implemented and tested.
