import hashlib

message = "THE LEGACY OF SURANAREE LIVES ON. Established in 1990, the university stands as a beacon of knowledge. Located in Nakhon Ratchasima, Thailand, with postal code 30000. This message has been protected by the sacred cryptographic arts. VERIFICATION CODE: SUT_LEGACY_1990_VERIFIED"
signature = "PIDhtqszS7z8uBQnhxeG3vNA5aaZv+mrQJRhlMkUC5Yh9xCimsSrSqLbq1xlmodK8LiUI+0+b8mMTsxPKBZd26uHIat6G/oJnCEcmcOqsBqIRAI53b5gmqPOdQXmNkQJZltGj5buc1YIfQdO6t17f9TgXj8ZbfPpUvhnbWd/T8jSxSUaeFPHsNjJGvgPQq+Gic3FFUytqUg3UpwICVE8FCqHFe6uE2aQeWa/jKAJHv0lZ5/iDlFAzk2+ZfI0IzDqvKqaBlp+ZJx3oEU41LCp/4/uW3smtF07iLsdwYK9GGOthoBIYEykYUNHepL6kKezE7UkbkygK3I706fVJBtqIA=="

data = message + "27072533" + signature
hash_result = hashlib.sha256(data.encode()).hexdigest()[:32]
FLAG_1 = f"MUT{{{hash_result}}}"
print(FLAG_1)