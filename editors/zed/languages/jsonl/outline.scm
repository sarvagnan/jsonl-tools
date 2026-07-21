; A non-empty object is named after the key of its first pair.
(document
  (object
    .
    (pair
      key: (string) @name)) @item)

; Empty objects and other top-level JSON values use their own text as a label.
(document
  (object
    "{"
    "}") @name @item)

(document
  [
    (array)
    (string)
    (number)
    (true)
    (false)
    (null)
  ] @name @item)
