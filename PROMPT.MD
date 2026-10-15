# Insulation Calculator 개발 지시서

## 1. 프로젝트 개요

호주 단열재 설치 작업자를 위한 **Insulation Material Calculator** 웹 애플리케이션을 개발한다.

사용자가 단열재 설치 지시서(Work Order)를 이미지로 업로드하면 OCR을 통해 필요한 정보를 자동 추출하고, 자재별 필요 수량을 계산하여 보여준다.

**핵심 목표**
- 100% 무료 OCR 사용
- 외부 AI API 사용 금지
- 모바일 환경 최적화
- 빠르고 간편한 사용성
- 서버 없이 클라이언트에서 모든 작업 처리
- 영어로 작성된 단열재 설치 지시서 지원

## 2. 기술 스택

| 항목 | 기술 |
|---|---|
| Framework | Vue 3 |
| Language | TypeScript (Strict) |
| Build Tool | Vite |
| OCR | Tesseract.js |
| Image Processing | Canvas API |
| Validation | Zod |
| Styling | SCSS |
| State Management | Pinia |
| Icons | Lucide |
| Deployment | Netlify |

별도의 백엔드 서버는 구축하지 않는다.

OCR 처리는 Web Worker를 활용하여 UI가 멈추지 않도록 구현한다.

## 3. 주요 기능

### 3.1 이미지 업로드

다음 기능을 구현한다.

- 이미지 파일 업로드 (PNG, JPG, JPEG, WEBP)
- 모바일 카메라 촬영 지원
- 드래그 앤 드롭 업로드
- 여러 이미지 업로드 지원
- 이미지 미리보기
- 업로드 이미지 삭제
- 이미지 확대 및 확인

iPhone Safari 환경을 우선적으로 고려한다.

### 3.2 이미지 전처리

OCR 인식률 향상을 위해 Canvas API로 다음 기능을 구현한다.

- 이미지 해상도 조절
- Grayscale 변환
- Contrast 조정
- Threshold 이진화
- 필요 시 이미지 영역별 Crop
- 원본 이미지와 전처리 이미지 비교

전처리 옵션은 사용자가 선택할 수 있도록 한다.

### 3.3 OCR

Tesseract.js를 사용한다.

- 영어(`eng`) 인식
- OCR 진행률 표시
- OCR 실패 시 재시도
- Worker 재사용
- Worker 종료 및 메모리 정리
- OCR 결과 텍스트 확인 기능

가능하면 OCR 단어별 위치 정보(Bounding Box)를 활용하여 표의 열과 행을 구분한다.

OCR 결과는 단순 문자열뿐 아니라 위치 정보도 활용할 수 있도록 설계한다.

### 3.4 데이터 추출

OCR 결과에서 다음 데이터를 추출한다.

**Job 정보**
- Job ID
- Property Address
- Property Name
- Job Date

**단열재 정보**
- Insulation Type 1
- Insulation Type 2
- m2 of insulation type 1
- m2 of insulation type 2
- Material Description
- Coverage per Pack
- Installation Area

한 장의 이미지에 여러 Job이 존재할 수 있다.

각 Job을 독립적으로 구분하여 추출해야 한다.

### 3.5 데이터 파싱 규칙

다음과 같은 텍스트를 처리해야 한다.

예시 1:

`ThermoBatts Ceiling R4.1 580mm 7.40m2 per pack (8in1)`

추출 결과:

```json
{
  "brand": "ThermoBatts",
  "category": "Ceiling",
  "rValue": "R4.1",
  "width": 580,
  "coveragePerPack": 7.4,
  "piecesPerPack": 8
}
```

예시 2:

`ThermoBatts Wall R2.5HD 580mm 6.73m2 per pack (8in1)`

추출 결과:

```json
{
  "brand": "ThermoBatts",
  "category": "Wall",
  "rValue": "R2.5HD",
  "width": 580,
  "coveragePerPack": 6.73,
  "piecesPerPack": 8
}
```

OCR 결과에는 공백 누락, 줄바꿈, 특수문자 오인식이 발생할 수 있다.

이를 고려하여 정규표현식과 텍스트 정규화 로직을 구현한다.

단, 서로 다른 Job의 데이터가 섞이지 않도록 주의한다.

확실하게 인식되지 않은 데이터는 임의로 생성하지 말고 사용자에게 수정하도록 표시한다.

## 4. 자재 수량 계산

### 기본 계산

```typescript
const requiredPacks = Math.ceil(
  installationArea / coveragePerPack
);
```

예시:

- 설치 면적: 117㎡
- Pack 커버리지: 7.40㎡
- 필요 Pack: 16

### Single 수량

`8in1`은 1팩에 단열재 8장이 포함되어 있다는 의미로 처리한다.

```typescript
const requiredSingles =
  requiredPacks * piecesPerPack;
```

위 계산은 주문할 전체 팩에 포함된 낱장 수를 의미한다.

별도로 실제 설치 면적에 필요한 낱장 수를 추정하려면 다음과 같이 계산한다.

```typescript
const estimatedSingles = Math.ceil(
  installationArea /
  (coveragePerPack / piecesPerPack)
);
```

두 값은 구분하여 표시한다.

- Required Packs
- Estimated Singles
- Singles in Ordered Packs

자재에 `8in1` 정보가 없다면 Single 수량을 임의로 계산하지 않는다.

### 자재 합산

동일 자재가 여러 Job에 존재하면 합산한다.

동일 자재 판별 기준:

- Brand
- Category
- R-Value
- Width
- Coverage per Pack
- Pieces per Pack

**동일 자재의 설치 면적을 먼저 합산한 후 Pack 수량을 올림 처리한다.**

단, Job별 수량도 별도로 표시한다.

## 5. 테스트 데이터

다음 데이터를 기준으로 테스트한다.

| Job ID | Material | Area | Coverage |
|---|---|---|---|
| 205958 | Ceiling R4.1 580mm | 117 | 7.40 |
| 205958 | Ceiling R4.1 430mm | 32 | 5.49 |
| 205959 | Wall R2.0 580mm | 130 | 14.13 |
| 205959 | Wall R2.5HD 580mm | 96 | 6.73 |

예상 결과:

| Material | Packs |
|---|---|
| Ceiling R4.1 580mm | 16 |
| Ceiling R4.1 430mm | 6 |
| Wall R2.0 580mm | 10 |
| Wall R2.5HD 580mm | 15 |

Total: 47 Packs

OCR 파싱 테스트는 실제 OCR 출력처럼 줄바꿈과 공백이 불규칙한 문자열도 포함한다.

## 6. UI/UX

모바일 우선 반응형 디자인을 구현한다.

전체 UI는 영어로 작성한다.

### 화면 구성

**Upload Section**
- 이미지 업로드
- 카메라 촬영
- 이미지 미리보기

**Processing Section**
- OCR 진행률
- 현재 처리 중인 이미지
- 오류 메시지

**Job Details**
- Job ID
- Address
- Material
- Installation Area
- Coverage
- Packs
- Singles

**Material Summary**
- 동일 자재 그룹화
- 총 설치 면적
- 총 필요 Pack
- 총 Single

### 편집 기능

OCR 결과는 사용자가 직접 수정할 수 있어야 한다.

- 면적 수정
- 자재명 수정
- 커버리지 수정
- Pack당 낱장 수 수정
- Job 삭제
- 자재 추가 및 삭제

수정 시 모든 계산 결과를 즉시 업데이트한다.

### 결과 내보내기

- 결과 클립보드 복사
- CSV 다운로드
- 모바일 공유 기능(Web Share API 지원 시)

## 7. 프로젝트 구조

```text
src/
├── components/
│   ├── ImageUploader.vue
│   ├── ImagePreview.vue
│   ├── OCRProgress.vue
│   ├── JobCard.vue
│   ├── MaterialEditor.vue
│   └── MaterialSummary.vue
├── composables/
│   ├── useOCR.ts
│   └── useImageProcessing.ts
├── services/
│   ├── ocr.service.ts
│   ├── parser.service.ts
│   └── calculator.service.ts
├── stores/
│   └── insulation.store.ts
├── types/
│   └── insulation.ts
├── utils/
│   ├── image.ts
│   ├── regex.ts
│   └── export.ts
├── workers/
│   └── ocr.worker.ts
├── views/
│   └── HomeView.vue
└── App.vue
```

구조는 필요에 따라 개선할 수 있다.

## 8. 개발 원칙

1. TypeScript Strict Mode 사용
2. Vue Composition API 및 `<script setup>` 사용
3. 모든 계산 로직은 순수 함수로 구현
4. OCR과 파싱 로직 분리
5. OCR 인식 실패 시 수동 입력 지원
6. OCR 데이터가 불확실한 경우 사용자 확인 요청
7. 하드코딩된 자재 목록에 의존하지 않을 것
8. 외부 유료 API 사용 금지
9. 이미지 및 작업 데이터는 외부 서버에 업로드하지 않을 것
10. iOS Safari 및 Android Chrome 지원

## 9. 테스트

Vitest를 사용하여 다음 항목을 테스트한다.

- 자재명 파싱
- R-Value 추출
- Width 추출
- Coverage 추출
- 8in1 추출
- Job별 데이터 분리
- Pack 계산
- Single 계산
- 동일 자재 그룹화
- OCR 오인식 처리
- 잘못된 숫자 및 0으로 나누기 방지

## 10. 개발 순서

다음 순서로 작업한다.

**Phase 1 — Project Setup**

Vue3, Vite, TypeScript, SCSS, Pinia 설정

**Phase 2 — Image Upload**

이미지 업로드 및 전처리 기능 구현

**Phase 3 — OCR Integration**

Tesseract.js 연결 및 OCR 처리 구현

**Phase 4 — Text Parsing**

OCR 결과에서 Job 및 단열재 정보 추출

**Phase 5 — Calculator**

자재별 Pack / Single 수량 계산

**Phase 6 — UI Development**

모바일 UI 및 결과 화면 구현

**Phase 7 — Export**

CSV, 클립보드 복사 기능 구현

**Phase 8 — Testing**

단위 테스트 및 오류 수정

## 11. 완료 조건

- 사용자가 이미지를 업로드할 수 있다.
- Tesseract.js로 영어 텍스트를 추출한다.
- 여러 Job을 구분한다.
- 자재명, 면적, 커버리지를 추출한다.
- 자재별 Pack 수량을 정확히 계산한다.
- Single 수량을 계산한다.
- OCR 오류를 수동으로 수정할 수 있다.
- 모바일 Safari에서 정상 작동한다.
- 외부 서버 없이 실행할 수 있다.
- 빌드 및 테스트가 통과한다.

---

## Codex 작업 지침

위 명세에 따라 실제 작동하는 애플리케이션을 구현해줘.

기존 프로젝트가 있다면 구조를 먼저 분석하고 활용해.

프로젝트가 비어 있다면 새로 생성해.

각 Phase를 순서대로 진행해.

필요한 라이브러리는 직접 설치해.

구현한 기능은 테스트해.

임시 Mock으로 핵심 기능을 대체하지 마.

OCR 정확도가 부족하면 이미지 전처리와 위치 기반 파싱을 개선해.

추출이 불가능한 필드는 사용자 수정이 가능하도록 처리해.

불필요한 백엔드나 데이터베이스는 만들지 마.

작업 완료 후 구현 결과, 테스트 결과, 남은 문제를 한국어로 보고해.



## 최종 목표: 작업자가 단열재 설치 지시서를 사진으로 찍기만 하면 필요한 자재 종류와 Pack/Single 수량을 즉시 확인할 수 있는 웹앱을 완성하는 것.
