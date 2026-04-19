

# Very important, the data below is the curl, that does not mean we nees to send all the headers was informed, the loggin to the scrapping is working fine. 


# musgrave

curl 'https://www-api.musgravemarketplace.ie/INTERSHOP/rest/WFS/musgrave-MWPIRL-Site/-;loc=en_IE;cur=EUR/baskets/current/items?msgSkipFulfillmentCheck&include=bulkUpdate' \
  -H 'accept: application/vnd.intershop.basket.v1+json' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authentication-token: encryption0@PBEWithMD5AndTripleDES:cczy85cPAoY=|dvLm2iGl1vP755/D9o1ZMnaks4MVktH8ZiGkMg9i6bR1PonlxzOqamsLlmFGBIA6|sa2dc8d9a596b06c7' \
  -H 'content-type: application/json' \
  -H 'origin: https://www.musgravemarketplace.ie' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.musgravemarketplace.ie/' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  --data-raw '[{"product":"698715","quantity":{"value":1,"unit":"15 ml"},"calculated":true},{"product":"774517","quantity":{"value":2,"unit":"28 g"},"calculated":true},{"product":"401409","quantity":{"value":3,"unit":"1.50 kg"},"calculated":true},{"product":"774514","quantity":{"value":4,"unit":"36 g"},"calculated":true}]'

- I have tested sending like this  and it worked fine. 
```json
[
	{"product":"698715","quantity":{"value":1}},
	{"product":"944163","quantity":{"value":2}},
	{"product":"164110","quantity":{"value":4}}
]

# Savage 

curl 'https://www.savageandwhitten.com/umbraco/surface/Basket/QuickAddAddToBasket' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'content-type: application/x-www-form-urlencoded; charset=UTF-8' \
  -b '_ga=GA1.1.980131547.1768850835; self_device_id=5340aebf-cdc1-4226-a935-40de0606b335; _fbp=fb.1.1768850835315.646524593282367077; ActiveProductCategory=1; Test=Test%20value; .AspNetCore.Antiforgery.YCXxniLWdbE=CfDJ8Cf7eGfWhZZCoqRhKLM9iujg-kIdVQb4lLcOp6AFeFWMJOB6GdgkcU6TlKdVG3lbTBK3M1U_ak-ohvJ7-FNdofdoCY6wcWB9cKXP4dbldje7uT-Tvkk0pMrX4FIzAkrMJdg3DojCOC4L6Oqo91zfQPg; .AspNetCore.Identity.Application=CfDJ8Cf7eGfWhZZCoqRhKLM9iuhbbXwn4ql2UHxYEpjdKHSiE16CZ_YqDuXwRxn8Eh2V1PMXMLL3ypQ9Cd_WV4ggGpmmHYLNox8dKvguugptVjnSYaJt9JYU-crK5DCsqPwrD5zovmYcPWlkRyFUovHrNvv-WpAj3PiK-DIZVUAG83fI2qiQu0_HmlzCyId_lltXKL1FGoWxoK5rhausWQ1Zf_HA6A7lNbinPCMO2HKvhBeLlLeS6rxXye0MKf5xR4aMQ2x0fugkhnCjXLM_OvjmIpU_phSAhr7cyzsy5XpLUt3f4kFRIfuNjwfVyvZgZ6Kw3rXsuers7r5WcdNj2OM5XXXWeNejavyzNAfMvqCBOqpJglAFbp-UmJbIaJMMKBFRECQAaMOveSad9WnZDfXFqrAFoFxNxaOxWVMp8eVyNtNoWLkUpbRYSk6xgiO7HF7FCQaC9krfaQ__hMzP4hLwHwkxTbx9oew_9PGvacMUV9hBohN_RRM08kI67Q8Rs6oNc39mgzOKZBFkCg21FFQPDnAiParJB8gmkmcj2eZbwYxTOCabgeKfLSXMcu-pJ9gLuVHfpmVNGAc4q2_PBvyl-zCLrWvHmsOYwvvN_Qy7fUHJl0BrVl1spl5VOJVujMWuUhgBVZjTyU_Lny9Bi6W264xgBwlMVTsxwBBdUgdZxEtOdGsVUSkDRqb9QQ9QUwsfUNvsTNtEJVFSj1wGA0CKhvE; .AspNetCore.Mvc.CookieTempDataProvider=CfDJ8Cf7eGfWhZZCoqRhKLM9iugzkLZcxSdJog4FT_eue77ksQnNHI1bX0NPR8kETssu2idnBndCi91QESRsuhMpfN4VhEoNyEY6H5JxCnNM333lYXQgW0MsVler8z4F1AKtTTssylG5gWZ3Xa6Kq61d6PA; _ga_5E53CH5E4D=GS2.1.s1769860374$o12$g1$t1769860585$j60$l0$h0' \
  -H 'origin: https://www.savageandwhitten.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.savageandwhitten.com/quick-order/' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  -H 'x-requested-with: XMLHttpRequest' \
  --data-raw 'quickAddItems%5B0%5D%5BCode%5D=8464&quickAddItems%5B0%5D%5BQuantity%5D=1&quickAddItems%5B0%5D%5BProductId%5D=4643&quickAddItems%5B1%5D%5BCode%5D=9238&quickAddItems%5B1%5D%5BQuantity%5D=1&quickAddItems%5B1%5D%5BProductId%5D=5459&quickAddItems%5B2%5D%5BCode%5D=9239&quickAddItems%5B2%5D%5BQuantity%5D=1&quickAddItems%5B2%5D%5BProductId%5D=5460'


# Oreyllys 


curl 'https://order.oreillyswholesale.com/products/quickAdd.asp' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'cache-control: max-age=0' \
  -H 'content-type: application/x-www-form-urlencoded' \
  -b '_ga=GA1.2.1929675504.1769027979; _gcl_au=1.1.1011507843.1769027980; _ga_P2DQSC29NV=GS2.2.s1769106373$o2$g0$t1769106373$j60$l0$h0; ASPSESSIONIDAGRTCSDD=MNPJJFLCECIIAMEPMLNMHFJC; __cf_bm=6mnyXyLs8lBIyygjuI3kVSL2LWkmGLuqOZz5O3lgUfk-1769861080-1.0.1.1-rIu4yQU6KFFmgGJbroNHqLf.WH42qKC0kMwLpiY2rWyEto5aHnPJh4ivnJsjFkeawl84SCQfg2TxWcs3PE_JKYa5AopBnRb24IL1aSHDhOE' \
  -H 'origin: https://order.oreillyswholesale.com' \
  -H 'priority: u=0, i' \
  -H 'referer: https://order.oreillyswholesale.com/Products/quickv4.asp' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: navigate' \
  -H 'sec-fetch-site: same-origin' \
  -H 'upgrade-insecure-requests: 1' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  --data-raw 'product_code1=039700&product_qty1=1&product_code2=039699&product_qty2=2&product_code3=040885&product_qty3=3&product_code4=&product_qty4=&product_code5=&product_qty5=&product_code6=&product_qty6=&product_code7=&product_qty7=&product_code8=&product_qty8=&product_code9=&product_qty9=&product_code10=&product_qty10=&product_code11=&product_qty11=&product_code12=&product_qty12=&product_code13=&product_qty13=&product_code14=&product_qty14=&product_code15=&product_qty15=&product_code16=&product_qty16=&product_code17=&product_qty17=&product_code18=&product_qty18=&product_code19=&product_qty19=&product_code20=&product_qty20=&product_code21=&product_qty21=&product_code22=&product_qty22=&product_code23=&product_qty23=&product_code24=&product_qty24=&product_code25=&product_qty25=&product_code26=&product_qty26=&product_code27=&product_qty27=&product_code28=&product_qty28=&product_code29=&product_qty29=&product_code30=&product_qty30=&product_code31=&product_qty31=&product_code32=&product_qty32='



# Berry

curl 'https://ind.barrys.ie/products/AddLine.asp?ProdCode=1402843&Qty=2' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9' \
  -b '_ga=GA1.2.790059976.1768941886; ASPSESSIONIDAGQRDTAD=ABEANGLCFFFDELPNHMKMGJDO; __cf_bm=2e6j6lSSupBbUcS10PpKnU9dRhulqXHdGKuijhGh5A8-1769861251-1.0.1.1-GtXt5s1MEc_jVvoai1b45vu2_AKYTJ7w6n6KDhFStYbISF0PCYQkQimpVEhqfTmyYPxek5j6fgq2aAOG5xSBptFBhJ9bhfAbe1JbVdU0E.8; _gid=GA1.2.453465233.1769861253; _gat=1; _ga_45JMY0CMPJ=GS2.2.s1769861252$o6$g1$t1769861358$j60$l0$h0' \
  -H 'priority: u=1, i' \
  -H 'referer: https://ind.barrys.ie/products/gridlist.asp?department=6&prodgroup=14' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
