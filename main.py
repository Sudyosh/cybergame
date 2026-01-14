import hashlib

message = "THE LEGACY OF SURANAREE LIVES ON. Established in 1990, the university stands as a beacon of knowledge. Located in Nakhon Ratchasima, Thailand, with postal code 30000. This message has been protected by the sacred cryptographic arts. VERIFICATION CODE: SUT_LEGACY_1990_VERIFIED"
signature = "EZKq64tzLIgpUMbhRLW3FmKQ1Day7uzAz+9dHhI/Hw06gj2P/XQxQps//5vq6Xk+UR7iJ35seoFWLxaLahEWAufuoRbjsr+G7ZjHyHHaKntx6egPFCYOOFzHIqCGmojpABtkrrHJ6yWmjK3FAjdOpNKha0SzTpoBHjXNXIOlUrZGNlOsiPLrGBDzovMed6gWcmDSRAQouNQqPOzLfwLFAv5ddAZl6XQkcEbNY/rLYufuNUjqcg8BH1oMtw4y2fbAh5Bti/0VHt9kFPagKXgMFSPJTMWjJjDrYIPEg6LAtY2bSUcRTKCIWxpiiIJ55MpIZEiRDI9QZHt3WXF1OtFJXA=="

data = message + "27072533" + signature
hash_result = hashlib.sha256(data.encode()).hexdigest()[:32]
FLAG_1 = f"MUT{{{hash_result}}}"
print(FLAG_1)