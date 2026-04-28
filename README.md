# web-md

브라우저에서 Markdown을 실시간으로 편집하고 미리보는 웹 에디터입니다.

## 개요

Markdown, 코드 하이라이팅, LaTeX 처리, 파일/폴더 열기 흐름을 한 페이지에서 다루는 웹 기반 편집기입니다.

주요 파일:
- `index.html`: 메인 화면
- `script.js`: 편집/미리보기 로직
- `style.css`: 스타일
- `latex.js`, `LatexTable.js`: LaTeX 보조 스크립트
- `serve_local.py`, `serve_web.py`: 로컬 실행 보조

## 기능

- 실시간 Markdown 렌더링
- 코드 하이라이팅
- LaTeX 수식 처리
- 로컬 파일 열기
- 이미지 폴더 연결 후 미리보기

## 실행 방법

정적 서버 또는 간단한 Python 서버로 실행합니다.

```bash
python serve_local.py
```

또는

```bash
python -m http.server 8000
```

브라우저에서 `index.html`을 열면 됩니다.
