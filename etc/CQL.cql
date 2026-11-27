

SELECT from Genres where parent_ID is null
SELECT from Genres where parent.ID is null
SELECT from Genres where parent is null --> auto-coerced to the one above

SELECT from Genres { name, children[where parent.name = 'Fiction'] }

INSERT into Books {
  title: "New Book Title",
  author_ID: 333, -- kjhkjhk
}

INSERT into Books {
  title: "New Book Title",
  author: {ID:333},
}

INSERT into Books
  title: "New Book Title",
  author: 333,
}

UPDATE Books with {
  title: "New Book Title",
  author: 333,
} where ID = ?

DELETE from Books where ID = ?

SELECT from Books[ID] -- 404
DELETE from Books[ID] -- 404
UPDATE Books[ID]      -- 404
