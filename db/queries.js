module.exports = {
  getAllContacts: `
    SELECT id, full_name, phone, email, subject, message, created_at 
    FROM contacts 
    ORDER BY created_at DESC
  `,
  insertContact: `
    INSERT INTO contacts (full_name, phone, email, subject, message)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, full_name, phone, email, subject, message, created_at
  `,
};
