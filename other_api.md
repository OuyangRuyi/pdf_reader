# Other APIs

## Doubao: ARK
```python
import os
from volcenginesdkarkruntime import Ark

client = Ark(
    api_key=os.environ.get("ARK_API_KEY"),
    # The base URL for model invocation .
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    )
completion = client.chat.completions.create(
    # Replace with Model ID .
    model="doubao-seed-1-6-251015",
    messages=[
        {"role": "user", "content": "Hello"}
    ]
)
print(completion.choices[0].message)
```

## Gemini: gemini-2.5-flash, gemini-2.5-flash-image, gemini-3-pro-preview, gemini-3-pro-image-preview

Alrerady existed in code: gemini-2.5-flash.

This is gemini-2.5-flash-image:
```python
from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

prompt = (
    "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"
)

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[prompt],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
```


This is gemini-3-pro-preview:
```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="How does AI work?",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="low")
    ),
)

print(response.text)
```

This is gemini-3-pro-image-preview:
```python
from google import genai
from google.genai import types
from PIL import Image

prompt = "An office group photo of these people, they are making funny faces."
aspect_ratio = "5:4" # "1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"
resolution = "2K" # "1K", "2K", "4K"

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        prompt,
        Image.open('person1.png'),
        Image.open('person2.png'),
        Image.open('person3.png'),
        Image.open('person4.png'),
        Image.open('person5.png'),
    ],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=resolution
        ),
    )
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif image:= part.as_image():
        image.save("office.png")
```

## Deepseek: OpenAI SDK
This is chat version:
```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url="https://api.deepseek.com")

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    stream=False
)

print(response.choices[0].message.content)
```

This is reasoner version:
```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url="https://api.deepseek.com")

response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    stream=False
)

print(response.choices[0].message.content)
```

